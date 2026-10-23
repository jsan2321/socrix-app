import { getSessionById, getSessionByIdForUser, getSessionAnswers } from "@/lib/db/sessions";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { getProvider } from "@/lib/ai/get-provider";
import { withStructuredOutput } from "@/lib/ai/structured-output";
import { selectConceptChunk } from "@/lib/quiz/concept-selection";
import { calculateDifficulty } from "@/lib/quiz/difficulty";
import { validatePostGenerationChecks } from "@/lib/quiz/post-checks";
import {
  buildDevilsAdvocatePrompt,
  buildRepairPrompt,
} from "@/lib/ai/prompts/devils-advocate";
import { DevilsAdvocateSchema, DevilsAdvocateQuestion } from "@/schemas/quiz";
import {
  createQuizQuestionWithStatements,
  getGeneratedQuestionByRequestId,
  QuizQuestionWithStatements,
} from "@/lib/db/quiz";
import type { LLMProvider } from "@/lib/ai/ai-provider";
import { ProviderError } from "@/lib/errors";
import { logAIRequest, generateRequestId } from "@/lib/observability/log";

export interface QuizGenerationInput {
  sessionId: string;
  /** Required for HTTP requests; omitted only by trusted internal services/tests. */
  userId?: string;
  excludeChunkIds?: string[];
  overrideProvider?: string;
  requestId?: string;
  onProgress?: (status: "selecting" | "generating" | "validating" | "persisting") => void;
}

export interface QuizGenerationResult extends QuizQuestionWithStatements {
  mode: "identify_truth" | "identify_both_lies";
  questionTarget?: number | null;
}

async function streamStructuredQuestion(provider: LLMProvider, systemPrompt: string, userPrompt: string): Promise<DevilsAdvocateQuestion> {
  const chunks: string[] = [];
  const jsonPrompt = `${systemPrompt}\n\nRespond only with valid raw JSON matching the requested schema. Do not use markdown fences or commentary.`;
  for await (const chunk of provider.streamText({ systemPrompt: jsonPrompt, userPrompt, temperature: provider.config.temperature })) {
    chunks.push(chunk);
  }
  const content = chunks.join("").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  return DevilsAdvocateSchema.parse(JSON.parse(content));
}

/**
 * Main quiz generation orchestrator service.
 * Selects concept -> computes difficulty -> prompts AI provider -> runs Zod parse & post-checks -> repair-retry loop -> DB persistence.
 */
export async function generateDevilsAdvocateQuiz(
  input: QuizGenerationInput
): Promise<QuizGenerationResult> {
  const { sessionId, userId, excludeChunkIds = [], overrideProvider, onProgress } = input;
  const requestId = input.requestId ?? generateRequestId();
  const startTime = Date.now();

  // 1. Resolve study session & document
  const session = userId ? await getSessionByIdForUser(sessionId, userId) : await getSessionById(sessionId);

  if (input.requestId) {
    const existing = await getGeneratedQuestionByRequestId(sessionId, input.requestId);
    if (existing) return { ...existing, mode: session.mode, questionTarget: session.question_target ?? null };
  }

  onProgress?.("selecting");

  // 2. Aggregate chunks already answered in this session to prevent repetition
  const sessionExcludedChunkIds: string[] = [];
  try {
    const sessionAnswers = typeof getSessionAnswers === "function"
      ? await getSessionAnswers(sessionId).catch(() => [])
      : [];
    if (sessionAnswers && sessionAnswers.length > 0) {
      const qIds = sessionAnswers.map((a) => a.question_id);
      const supabase = getSupabaseAdminClient();
      const { data: answeredQuestions } = await supabase
        .from("quiz_questions")
        .select("grounding_chunk_ids")
        .in("id", qIds);
      if (answeredQuestions) {
        for (const q of answeredQuestions) {
          if (Array.isArray(q.grounding_chunk_ids)) {
            sessionExcludedChunkIds.push(...q.grounding_chunk_ids);
          }
        }
      }
    }
  } catch {
    // Graceful fallback to client-provided excludeChunkIds
  }

  const effectiveExcludeChunkIds = Array.from(
    new Set([...excludeChunkIds, ...sessionExcludedChunkIds])
  );

  const quizLanguage = (session.quiz_language as "auto" | "en" | "es") ?? "auto";

  // 3. Select concept chunk
  const { selectedChunk, conceptTitle, sourceContext } = await selectConceptChunk(
    session.document_id,
    effectiveExcludeChunkIds,
    quizLanguage
  );

  // 3. Compute heuristic difficulty
  const difficulty = calculateDifficulty(sourceContext);

  // 4. Resolve AI provider
  const provider = getProvider(overrideProvider);
  const maxRetries =
    provider.config.capabilities.jsonReliability === "high" ? 2 : 3;

  // 5. Build prompt with enforced target language
  const initialPrompt = buildDevilsAdvocatePrompt(
    conceptTitle,
    difficulty,
    sourceContext,
    quizLanguage
  );

  const currentSystemPrompt = initialPrompt.systemPrompt;
  let currentUserPrompt = initialPrompt.userPrompt;
  let attempts = 0;
  let lastErrors: string[] = [];
  let validatedQuestion: DevilsAdvocateQuestion | null = null;
  let streamFailed = false;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      onProgress?.("generating");
      const streaming = Boolean(onProgress && provider.config.capabilities.supportsStreaming && !streamFailed);
      let candidate: DevilsAdvocateQuestion;
      if (streaming) {
        try {
          candidate = await streamStructuredQuestion(provider, currentSystemPrompt, currentUserPrompt);
        } catch (error) {
          streamFailed = true;
          throw error;
        }
      } else {
        const result = await withStructuredOutput<DevilsAdvocateQuestion>(provider, {
          systemPrompt: currentSystemPrompt,
          userPrompt: currentUserPrompt,
          schema: DevilsAdvocateSchema,
          schemaName: "DevilsAdvocateSchema",
          maxRetries: 1,
          temperature: provider.config.temperature,
        });
        candidate = result.data;
      }

      onProgress?.("validating");
      const postCheck = validatePostGenerationChecks(candidate, sourceContext);

      if (postCheck.valid) {
        validatedQuestion = candidate;
        break;
      }

      // If post-checks fail, construct repair prompt for next attempt
      lastErrors = postCheck.errors;
      currentUserPrompt = buildRepairPrompt(initialPrompt.userPrompt, postCheck.errors, quizLanguage);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastErrors = [errMsg];
      currentUserPrompt = buildRepairPrompt(initialPrompt.userPrompt, [errMsg], quizLanguage);
    }
  }

  const latencyMs = Date.now() - startTime;

  if (!validatedQuestion) {
    logAIRequest({
      requestId,
      timestamp: new Date().toISOString(),
      route: "/api/quiz",
      provider: provider.name,
      model: provider.config.model,
      latencyMs,
      attempts,
      retryCount: attempts - 1,
      validationFailures: lastErrors.length > 0 ? lastErrors : undefined,
      outcome: "validation_exhausted",
    });

    throw new ProviderError(
      `Quiz generation failed after ${attempts} attempts: ${lastErrors.join("; ")}`,
      { provider: provider.name, attempts, errors: lastErrors }
    );
  }

  logAIRequest({
    requestId,
    timestamp: new Date().toISOString(),
    route: "/api/quiz",
    provider: provider.name,
    model: provider.config.model,
    latencyMs,
    attempts,
    retryCount: attempts - 1,
    validationFailures: lastErrors.length > 0 ? lastErrors : undefined,
    outcome: "success",
  });

  // 6. Randomize display order for the 3 statements (0, 1, 2)
  const randomizedIndices = [0, 1, 2].sort(() => Math.random() - 0.5);
  const statementInputs = validatedQuestion.statements.map((stmt, idx) => ({
    text: stmt.text,
    isTrue: stmt.isTrue,
    groundingRationale: stmt.groundingRationale,
    displayOrder: randomizedIndices[idx],
  }));

  // 7. Persist question and statements to database
  onProgress?.("persisting");
  const persisted = await createQuizQuestionWithStatements({
    documentId: session.document_id,
    concept: validatedQuestion.concept,
    difficulty: validatedQuestion.difficulty,
    groundingChunkIds: [selectedChunk.id],
    generationProvider: provider.name,
    generationModel: provider.config.model,
    generationAttempts: attempts,
    statements: statementInputs,
    sessionId: input.requestId ? sessionId : undefined,
    requestId: input.requestId,
  });

  return {
    ...persisted,
    mode: session.mode,
    questionTarget: session.question_target ?? null,
  };
}
