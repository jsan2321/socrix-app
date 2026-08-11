import { z } from "zod";

export const DocumentRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content_hash: z.string(),
  status: z.enum(["processing", "ready", "failed"]),
  failure_reason: z.string().nullable().optional(),
  chunks_embedded_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const DocumentChunkRowSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  chunk_index: z.number().int().nonnegative(),
  text: z.string(),
  token_count: z.number().int().positive(),
  page_start: z.number().int().optional(),
  page_end: z.number().int().optional(),
  paragraph_start: z.number().int().optional(),
  paragraph_end: z.number().int().optional(),
  heading: z.string().optional(),
  created_at: z.string(),
});

export const QuizQuestionRowSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  concept: z.string(),
  difficulty: z.enum(["foundational", "intermediate", "advanced"]),
  grounding_chunk_ids: z.array(z.string().uuid()),
  generation_model: z.string(),
  created_at: z.string(),
});

export const QuizStatementRowSchema = z.object({
  id: z.string().uuid(),
  question_id: z.string().uuid(),
  text: z.string(),
  is_true: z.boolean(),
  grounding_rationale: z.string().optional(),
  display_order: z.number().int().min(0).max(2),
});

export const UserSessionRowSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  session_token: z.string().uuid(),
  mode: z.enum(["identify_truth", "identify_both_lies"]),
  created_at: z.string(),
});

export const SessionAnswerRowSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  question_id: z.string().uuid(),
  selected_statement_ids: z.array(z.string().uuid()),
  is_correct: z.boolean(),
  confidence_level: z.number().int().min(1).max(5),
  evidence_viewed: z.boolean(),
  answered_at: z.string(),
});

export type DocumentRow = z.infer<typeof DocumentRowSchema>;
export type DocumentChunkRow = z.infer<typeof DocumentChunkRowSchema>;
export type QuizQuestionRow = z.infer<typeof QuizQuestionRowSchema>;
export type QuizStatementRow = z.infer<typeof QuizStatementRowSchema>;
export type UserSessionRow = z.infer<typeof UserSessionRowSchema>;
export type SessionAnswerRow = z.infer<typeof SessionAnswerRowSchema>;
