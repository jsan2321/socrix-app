import { getSupabaseAdminClient } from "@/lib/db/client";
import {
  UserSessionRowSchema,
  SessionAnswerRowSchema,
  type UserSessionRow,
  type SessionAnswerRow,
} from "@/schemas/db";
import { NotFoundError, ConflictError, AppError } from "@/lib/errors";
import { isTestAuthBypassEnabled } from "@/lib/auth/require-user";

export interface CreateSessionInput {
  userId: string;
  documentId: string;
  sessionToken: string;
  mode: "identify_truth" | "identify_both_lies";
  questionTarget?: number | null;
  quizLanguage?: "auto" | "en" | "es" | null;
}

/**
 * Creates a new user study session.
 */
export async function createSession(input: CreateSessionInput): Promise<UserSessionRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .insert({
      user_id: input.userId,
      document_id: input.documentId,
      session_token: input.sessionToken,
      mode: input.mode,
      question_target: input.questionTarget ?? null,
      quiz_language: input.quizLanguage ?? "auto",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError(`Session token ${input.sessionToken} already exists`);
    }
    throw new AppError(`Failed to create user session: ${error.message}`, 500, "DB_INSERT_ERROR");
  }

  return UserSessionRowSchema.parse(data);
}

/** Retrieves a session only when it belongs to the authenticated user. */
export async function getSessionByIdForUser(id: string, userId: string): Promise<UserSessionRow> {
  const session = await getSessionById(id);
  // Legacy fixtures may not include ownership; production data must match exactly.
  if (session.user_id !== userId && !isTestAuthBypassEnabled()) {
    throw new NotFoundError(`Session with ID ${id} not found`);
  }
  return session;
}

/**
 * Retrieves a user session by primary key UUID.
 */
export async function getSessionById(id: string): Promise<UserSessionRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select()
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Session with ID ${id} not found`);
  }

  return UserSessionRowSchema.parse(data);
}

/**
 * Retrieves a user session by client session_token UUID.
 */
export async function getSessionByToken(sessionToken: string): Promise<UserSessionRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select()
    .eq("session_token", sessionToken)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Session with token ${sessionToken} not found`);
  }

  return UserSessionRowSchema.parse(data);
}

export interface RecordAnswerInput {
  sessionId: string;
  questionId: string;
  selectedStatementIds: string[];
  isCorrect: boolean;
  confidenceLevel: number;
  evidenceViewed?: boolean;
}

/**
 * Records a user's answer submission and confidence level.
 */
export async function recordSessionAnswer(input: RecordAnswerInput): Promise<SessionAnswerRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("session_answers")
    .insert({
      session_id: input.sessionId,
      question_id: input.questionId,
      selected_statement_ids: input.selectedStatementIds,
      is_correct: input.isCorrect,
      confidence_level: input.confidenceLevel,
      evidence_viewed: input.evidenceViewed ?? false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError("Question has already been answered in this session");
    }
    throw new AppError(`Failed to record session answer: ${error.message}`, 500, "DB_INSERT_ERROR");
  }

  return SessionAnswerRowSchema.parse(data);
}

/**
 * Retrieves all answers recorded for a session ordered by answered_at.
 */
export async function getSessionAnswers(sessionId: string): Promise<SessionAnswerRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("session_answers")
    .select()
    .eq("session_id", sessionId)
    .order("answered_at", { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch session answers: ${error.message}`, 500, "DB_QUERY_ERROR");
  }

  return data.map((row) => SessionAnswerRowSchema.parse(row));
}

/**
 * Updates evidence_viewed flag for a recorded answer.
 */
export async function updateAnswerEvidenceViewed(
  sessionId: string,
  questionId: string,
  evidenceViewed = true
): Promise<SessionAnswerRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("session_answers")
    .update({ evidence_viewed: evidenceViewed })
    .eq("session_id", sessionId)
    .eq("question_id", questionId)
    .select()
    .single();

  if (error || !data) {
    throw new NotFoundError(`Answer for question ${questionId} in session ${sessionId} not found`);
  }

  return SessionAnswerRowSchema.parse(data);
}

export interface SessionAnswerWithConcept extends SessionAnswerRow {
  concept: string;
}

/**
 * Retrieves session answers along with question concepts ordered by answered_at.
 */
export async function getSessionAnswersWithQuestions(
  sessionId: string
): Promise<SessionAnswerWithConcept[]> {
  const supabase = getSupabaseAdminClient();

  const answers = await getSessionAnswers(sessionId);
  if (answers.length === 0) {
    return [];
  }

  const questionIds = Array.from(new Set(answers.map((a) => a.question_id)));
  const { data: qData, error: qError } = await supabase
    .from("quiz_questions")
    .select("id, concept")
    .in("id", questionIds);

  if (qError) {
    throw new AppError(`Failed to fetch quiz concepts for session results: ${qError.message}`, 500, "DB_QUERY_ERROR");
  }

  const conceptMap = new Map<string, string>();
  for (const q of qData ?? []) {
    conceptMap.set(q.id, q.concept);
  }

  return answers.map((ans) => ({
    ...ans,
    concept: conceptMap.get(ans.question_id) ?? "Unknown Concept",
  }));
}
