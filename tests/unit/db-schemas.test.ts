import { describe, it, expect } from "vitest";
import {
  DocumentRowSchema,
  DocumentChunkRowSchema,
  QuizQuestionRowSchema,
  QuizStatementRowSchema,
  UserSessionRowSchema,
  SessionAnswerRowSchema,
} from "@/schemas/db";

describe("Database Row Zod Schemas Validation", () => {
  it("should validate a valid DocumentRow", () => {
    const validDoc = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Test Textbook",
      content_hash: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
      status: "ready",
      chunks_embedded_count: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = DocumentRowSchema.safeParse(validDoc);
    expect(parsed.success).toBe(true);
  });

  it("should reject an invalid DocumentRow status", () => {
    const invalidDoc = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      title: "Test",
      content_hash: "hash",
      status: "invalid_status",
      chunks_embedded_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const parsed = DocumentRowSchema.safeParse(invalidDoc);
    expect(parsed.success).toBe(false);
  });

  it("should validate a valid DocumentChunkRow", () => {
    const validChunk = {
      id: "123e4567-e89b-12d3-a456-426614174001",
      document_id: "123e4567-e89b-12d3-a456-426614174000",
      chunk_index: 0,
      page_start: 1,
      page_end: 1,
      paragraph_start: 1,
      paragraph_end: 2,
      sentence_start: 1,
      sentence_end: 10,
      heading: "Chapter 1: Introduction",
      text: "This is sample semantic text chunk content.",
      token_count: 8,
      embedding: Array(1536).fill(0.1),
      created_at: new Date().toISOString(),
    };

    const parsed = DocumentChunkRowSchema.safeParse(validChunk);
    expect(parsed.success).toBe(true);
  });

  it("should parse string formatted embedding vector from PostgREST", () => {
    const chunkWithStringVector = {
      id: "123e4567-e89b-12d3-a456-426614174001",
      document_id: "123e4567-e89b-12d3-a456-426614174000",
      chunk_index: 0,
      page_start: 1,
      page_end: 1,
      paragraph_start: 1,
      paragraph_end: 2,
      sentence_start: 1,
      sentence_end: 10,
      heading: "Chapter 1: Introduction",
      text: "This is sample semantic text chunk content.",
      token_count: 8,
      embedding: "[0.1, 0.2, 0.3]",
      created_at: new Date().toISOString(),
    };

    const parsed = DocumentChunkRowSchema.safeParse(chunkWithStringVector);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.embedding).toEqual([0.1, 0.2, 0.3]);
    }
  });

  it("should validate QuizQuestionRow and QuizStatementRow", () => {
    const question = {
      id: "123e4567-e89b-12d3-a456-426614174002",
      document_id: "123e4567-e89b-12d3-a456-426614174000",
      concept: "Retrieval Practice",
      difficulty: "intermediate",
      grounding_chunk_ids: ["123e4567-e89b-12d3-a456-426614174001"],
      generation_provider: "openai",
      generation_model: "gpt-4o",
      generation_attempts: 1,
      created_at: new Date().toISOString(),
    };

    const statement = {
      id: "123e4567-e89b-12d3-a456-426614174003",
      question_id: question.id,
      text: "Retrieval practice strengthens memory retention more than re-reading.",
      is_true: true,
      grounding_rationale: "Supported directly by section 1.2 paragraph 2.",
      display_order: 0,
    };

    expect(QuizQuestionRowSchema.safeParse(question).success).toBe(true);
    expect(QuizStatementRowSchema.safeParse(statement).success).toBe(true);
  });

  it("should validate UserSessionRow and SessionAnswerRow", () => {
    const session = {
      id: "123e4567-e89b-12d3-a456-426614174004",
      document_id: "123e4567-e89b-12d3-a456-426614174000",
      session_token: "123e4567-e89b-12d3-a456-426614174005",
      mode: "identify_truth",
      created_at: new Date().toISOString(),
    };

    const answer = {
      id: "123e4567-e89b-12d3-a456-426614174006",
      session_id: session.id,
      question_id: "123e4567-e89b-12d3-a456-426614174002",
      selected_statement_ids: ["123e4567-e89b-12d3-a456-426614174003"],
      is_correct: true,
      confidence_level: 4,
      evidence_viewed: true,
      answered_at: new Date().toISOString(),
    };

    expect(UserSessionRowSchema.safeParse(session).success).toBe(true);
    expect(SessionAnswerRowSchema.safeParse(answer).success).toBe(true);
  });

  it("should reject confidence_level outside range 1-5", () => {
    const invalidAnswer = {
      id: "123e4567-e89b-12d3-a456-426614174006",
      session_id: "123e4567-e89b-12d3-a456-426614174004",
      question_id: "123e4567-e89b-12d3-a456-426614174002",
      selected_statement_ids: ["123e4567-e89b-12d3-a456-426614174003"],
      is_correct: true,
      confidence_level: 6, // invalid
      evidence_viewed: false,
      answered_at: new Date().toISOString(),
    };

    expect(SessionAnswerRowSchema.safeParse(invalidAnswer).success).toBe(false);
  });
});
