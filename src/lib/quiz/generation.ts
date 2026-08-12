import { getSessionById } from "@/lib/db/sessions";
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
  QuizQuestionWithStatements,
} from "@/lib/db/quiz";
import { ProviderError } from "@/lib/errors";

export interface QuizGenerationInput {
  sessionId: string;
  excludeChunkIds?: string[];
  overrideProvider?: string;
}

/**
 * Main quiz generation orchestrator service (FR-QUIZ-3, FR-QUIZ-8, FR-QUIZ-9).
 * Selects concept -> computes difficulty -> prompts AI provider -> runs Zod parse & post-checks -> repair-retry loop -> DB persistence.
 */
export async function generateDevilsAdvocateQuiz(
  input: QuizGenerationInput
): Promise<QuizQuestionWithStatements> {
  const { sessionId, excludeChunkIds = [], overrideProvider } = input;

  // 1. Resolve study session & document
  const session = await getSessionById(sessionId);

  // 2. Select concept chunk
  const { selectedChunk, conceptTitle, sourceContext } = await selectConceptChunk(
    session.document_id,
    excludeChunkIds
  );

  // 3. Compute heuristic difficulty
  const difficulty = calculateDifficulty(sourceContext);

  // 4. Resolve AI provider
  const provider = getProvider(overrideProvider);
  const maxRetries =
    provider.config.capabilities.jsonReliability === "high" ? 2 : 3;

  // 5. Build prompt
  const initialPrompt = buildDevilsAdvocatePrompt(
    conceptTitle,
    difficulty,
    sourceContext
  );

  const currentSystemPrompt = initialPrompt.systemPrompt;
  let currentUserPrompt = initialPrompt.userPrompt;
  let attempts = 0;
  let lastErrors: string[] = [];
  let validatedQuestion: DevilsAdvocateQuestion | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      const result = await withStructuredOutput<DevilsAdvocateQuestion>(provider, {
        systemPrompt: currentSystemPrompt,
        userPrompt: currentUserPrompt,
        schema: DevilsAdvocateSchema,
        schemaName: "DevilsAdvocateSchema",
        maxRetries: 1, // Individual attempt retry handle
        temperature: provider.config.temperature,
      });

      // Execute deterministic post-checks (FR-QUIZ-9)
      const postCheck = validatePostGenerationChecks(result.data, sourceContext);

      if (postCheck.valid) {
        validatedQuestion = result.data;
        break;
      }

      // If post-checks fail, construct repair prompt for next attempt
      lastErrors = postCheck.errors;
      currentUserPrompt = buildRepairPrompt(initialPrompt.userPrompt, postCheck.errors);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastErrors = [errMsg];
      currentUserPrompt = buildRepairPrompt(initialPrompt.userPrompt, [errMsg]);
    }
  }

  if (!validatedQuestion) {
    throw new ProviderError(
      `Quiz generation failed after ${attempts} attempts: ${lastErrors.join("; ")}`,
      { provider: provider.name, attempts, errors: lastErrors }
    );
  }

  // 6. Randomize display order for the 3 statements (0, 1, 2)
  const randomizedIndices = [0, 1, 2].sort(() => Math.random() - 0.5);
  const statementInputs = validatedQuestion.statements.map((stmt, idx) => ({
    text: stmt.text,
    isTrue: stmt.isTrue,
    groundingRationale: stmt.groundingRationale,
    displayOrder: randomizedIndices[idx],
  }));

  // 7. Persist question and statements to database
  const persisted = await createQuizQuestionWithStatements({
    documentId: session.document_id,
    concept: validatedQuestion.concept,
    difficulty: validatedQuestion.difficulty,
    groundingChunkIds: [selectedChunk.id],
    generationProvider: provider.name,
    generationModel: provider.config.model,
    generationAttempts: attempts,
    statements: statementInputs,
  });

  return persisted;
}
