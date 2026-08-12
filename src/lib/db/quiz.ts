import { getSupabaseAdminClient } from "@/lib/db/client";
import {
  QuizQuestionRowSchema,
  QuizStatementRowSchema,
  type QuizQuestionRow,
  type QuizStatementRow,
} from "@/schemas/db";
import { NotFoundError, AppError } from "@/lib/errors";

export interface StatementInput {
  text: string;
  isTrue: boolean;
  groundingRationale: string;
  displayOrder: number;
}

export interface CreateQuizQuestionInput {
  documentId: string;
  concept: string;
  difficulty: "foundational" | "intermediate" | "advanced";
  groundingChunkIds: string[];
  generationProvider: string;
  generationModel: string;
  generationAttempts?: number;
  statements: StatementInput[];
}

export interface QuizQuestionWithStatements {
  question: QuizQuestionRow;
  statements: QuizStatementRow[];
}

/**
 * Creates a quiz question and its statements atomically.
 */
export async function createQuizQuestionWithStatements(
  input: CreateQuizQuestionInput
): Promise<QuizQuestionWithStatements> {
  const supabase = getSupabaseAdminClient();

  // Insert Question
  const { data: qData, error: qError } = await supabase
    .from("quiz_questions")
    .insert({
      document_id: input.documentId,
      concept: input.concept,
      difficulty: input.difficulty,
      grounding_chunk_ids: input.groundingChunkIds,
      generation_provider: input.generationProvider,
      generation_model: input.generationModel,
      generation_attempts: input.generationAttempts ?? 1,
    })
    .select()
    .single();

  if (qError || !qData) {
    throw new AppError(`Failed to create quiz question: ${qError?.message}`, 500, "DB_INSERT_ERROR");
  }

  const questionRow = QuizQuestionRowSchema.parse(qData);

  // Insert Statements
  const statementsPayload = input.statements.map((s) => ({
    question_id: questionRow.id,
    text: s.text,
    is_true: s.isTrue,
    grounding_rationale: s.groundingRationale,
    display_order: s.displayOrder,
  }));

  const { data: sData, error: sError } = await supabase
    .from("quiz_statements")
    .insert(statementsPayload)
    .select();

  if (sError || !sData) {
    throw new AppError(`Failed to create quiz statements: ${sError?.message}`, 500, "DB_INSERT_ERROR");
  }

  const statementRows = sData.map((row) => QuizStatementRowSchema.parse(row));

  return {
    question: questionRow,
    statements: statementRows,
  };
}

/**
 * Retrieves a quiz question by its primary key UUID.
 */
export async function getQuizQuestionById(id: string): Promise<QuizQuestionRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("quiz_questions")
    .select()
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Quiz question with ID ${id} not found`);
  }

  return QuizQuestionRowSchema.parse(data);
}

/**
 * Retrieves statements for a question ordered by display_order.
 */
export async function getQuizStatementsByQuestionId(questionId: string): Promise<QuizStatementRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("quiz_statements")
    .select()
    .eq("question_id", questionId)
    .order("display_order", { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch statements for question: ${error.message}`, 500, "DB_QUERY_ERROR");
  }

  return data.map((row) => QuizStatementRowSchema.parse(row));
}

/**
 * Retrieves all quiz questions generated for a document.
 */
export async function getQuestionsByDocumentId(documentId: string): Promise<QuizQuestionRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("quiz_questions")
    .select()
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch questions for document: ${error.message}`, 500, "DB_QUERY_ERROR");
  }

  return data.map((row) => QuizQuestionRowSchema.parse(row));
}
