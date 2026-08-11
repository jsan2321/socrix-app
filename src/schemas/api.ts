import { z } from "zod";

/**
 * Upload Document parameters schema
 */
export const UploadDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty").optional(),
});

/**
 * Quiz generation request schema
 */
export const QuizRequestSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format"),
  excludeChunkIds: z.array(z.string().uuid()).optional().default([]),
});

/**
 * Evidence retrieval request schema
 */
export const EvidenceRequestSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID format"),
  questionId: z.string().uuid("Invalid question ID format"),
});

/**
 * Session creation request schema
 */
export const CreateSessionSchema = z.object({
  documentId: z.string().uuid("Invalid document ID format"),
  mode: z.enum(["identify_truth", "identify_both_lies"]).default("identify_truth"),
});

/**
 * Answer submission request schema
 */
export const AnswerSubmissionSchema = z.object({
  questionId: z.string().uuid("Invalid question ID format"),
  selectedStatementIds: z
    .array(z.string().uuid("Invalid statement ID format"))
    .min(1, "At least one statement must be selected")
    .max(2, "No more than 2 statements can be selected"),
  confidenceLevel: z
    .number()
    .int("Confidence must be an integer")
    .min(1, "Minimum confidence level is 1")
    .max(5, "Maximum confidence level is 5"),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
export type QuizRequestInput = z.infer<typeof QuizRequestSchema>;
export type EvidenceRequestInput = z.infer<typeof EvidenceRequestSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type AnswerSubmissionInput = z.infer<typeof AnswerSubmissionSchema>;
