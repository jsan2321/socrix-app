import { describe, it, expect } from "vitest";
import {
  UploadDocumentSchema,
  QuizRequestSchema,
  EvidenceRequestSchema,
  CreateSessionSchema,
  AnswerSubmissionSchema,
} from "@/schemas/api";
import {
  DocumentRowSchema,
  DocumentChunkRowSchema,
  SessionAnswerRowSchema,
} from "@/schemas/db";

describe("API & Database Schemas Negative Rejection Tests", () => {
  describe("UploadDocumentSchema Rejections", () => {
    it("rejects empty or whitespace-only title when title is provided", () => {
      const result = UploadDocumentSchema.safeParse({ title: "   " });
      expect(result.success).toBe(false);
    });
  });

  describe("QuizRequestSchema Rejections", () => {
    it("rejects non-UUID sessionId", () => {
      const result = QuizRequestSchema.safeParse({ sessionId: "not-a-uuid" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid session ID");
      }
    });

    it("rejects invalid UUIDs inside excludeChunkIds", () => {
      const result = QuizRequestSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        excludeChunkIds: ["not-a-uuid"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("EvidenceRequestSchema Rejections", () => {
    it("rejects missing or malformed questionId", () => {
      const result = EvidenceRequestSchema.safeParse({
        sessionId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "invalid-id",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing sessionId", () => {
      const result = EvidenceRequestSchema.safeParse({
        questionId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateSessionSchema Rejections", () => {
    it("rejects invalid documentId format", () => {
      const result = CreateSessionSchema.safeParse({
        documentId: "123-bad-id",
        mode: "identify_truth",
      });
      expect(result.success).toBe(false);
    });

    it("rejects unsupported session mode", () => {
      const result = CreateSessionSchema.safeParse({
        documentId: "550e8400-e29b-41d4-a716-446655440000",
        mode: "random_guess",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AnswerSubmissionSchema Rejections", () => {
    it("rejects confidenceLevel less than 1", () => {
      const result = AnswerSubmissionSchema.safeParse({
        questionId: "550e8400-e29b-41d4-a716-446655440000",
        selectedStatementIds: ["550e8400-e29b-41d4-a716-446655440001"],
        confidenceLevel: 0,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Minimum confidence level is 1");
      }
    });

    it("rejects confidenceLevel greater than 5", () => {
      const result = AnswerSubmissionSchema.safeParse({
        questionId: "550e8400-e29b-41d4-a716-446655440000",
        selectedStatementIds: ["550e8400-e29b-41d4-a716-446655440001"],
        confidenceLevel: 6,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Maximum confidence level is 5");
      }
    });

    it("rejects non-integer confidenceLevel (e.g. 3.5)", () => {
      const result = AnswerSubmissionSchema.safeParse({
        questionId: "550e8400-e29b-41d4-a716-446655440000",
        selectedStatementIds: ["550e8400-e29b-41d4-a716-446655440001"],
        confidenceLevel: 3.5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Confidence must be an integer");
      }
    });

    it("rejects empty selectedStatementIds array", () => {
      const result = AnswerSubmissionSchema.safeParse({
        questionId: "550e8400-e29b-41d4-a716-446655440000",
        selectedStatementIds: [],
        confidenceLevel: 3,
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 2 selectedStatementIds", () => {
      const result = AnswerSubmissionSchema.safeParse({
        questionId: "550e8400-e29b-41d4-a716-446655440000",
        selectedStatementIds: [
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002",
          "550e8400-e29b-41d4-a716-446655440003",
        ],
        confidenceLevel: 3,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Database Schema Rejections", () => {
    it("rejects DocumentRowSchema with invalid status enum", () => {
      const result = DocumentRowSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        title: "Test Doc",
        content_hash: "hash123",
        status: "in_progress", // Not processing, ready, failed
        chunks_embedded_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });

    it("rejects DocumentChunkRowSchema with negative token_count", () => {
      const result = DocumentChunkRowSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        document_id: "550e8400-e29b-41d4-a716-446655440001",
        chunk_index: 0,
        page_start: 1,
        page_end: 1,
        paragraph_start: 1,
        paragraph_end: 1,
        sentence_start: 1,
        sentence_end: 2,
        text: "Some text",
        token_count: -10, // Invalid: must be positive
        created_at: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });

    it("rejects SessionAnswerRowSchema with out-of-range confidence_level", () => {
      const result = SessionAnswerRowSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        session_id: "550e8400-e29b-41d4-a716-446655440001",
        question_id: "550e8400-e29b-41d4-a716-446655440002",
        selected_statement_ids: ["550e8400-e29b-41d4-a716-446655440003"],
        confidence_level: 7, // Invalid: must be <= 5
        is_correct: true,
        evidence_viewed: false,
        created_at: new Date().toISOString(),
      });
      expect(result.success).toBe(false);
    });
  });
});
