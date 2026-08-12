import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/evidence/route";
import * as sessionDb from "@/lib/db/sessions";
import * as quizDb from "@/lib/db/quiz";
import * as evidenceService from "@/lib/rag/evidence";
import { NotFoundError, InsufficientEvidenceError } from "@/lib/errors";

const MOCK_SESSION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MOCK_DOC_ID = "550e8400-e29b-41d4-a716-446655440002";
const MOCK_QUESTION_ID = "550e8400-e29b-41d4-a716-446655440003";
const MOCK_CHUNK_ID = "550e8400-e29b-41d4-a716-446655440004";
const MOCK_STATEMENT_ID = "550e8400-e29b-41d4-a716-446655440005";

vi.mock("@/lib/db/sessions");
vi.mock("@/lib/db/quiz");
vi.mock("@/lib/rag/evidence");

describe("Integration: Evidence Flow & API Endpoint (POST /api/evidence)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully retrieves evidence and updates evidence_viewed flag on recorded answer", async () => {
    // 1. Mock DB session lookup
    vi.spyOn(sessionDb, "getSessionById").mockResolvedValue({
      id: MOCK_SESSION_ID,
      document_id: MOCK_DOC_ID,
      session_token: "550e8400-e29b-41d4-a716-446655440099",
      mode: "identify_truth",
      created_at: new Date().toISOString(),
    });

    // 2. Mock DB question and statements lookup
    vi.spyOn(quizDb, "getQuizQuestionById").mockResolvedValue({
      id: MOCK_QUESTION_ID,
      document_id: MOCK_DOC_ID,
      concept: "Cellular Energy",
      difficulty: "foundational",
      grounding_chunk_ids: [MOCK_CHUNK_ID],
      generation_provider: "openai",
      generation_model: "gpt-4o",
      generation_attempts: 1,
      created_at: new Date().toISOString(),
    });

    vi.spyOn(quizDb, "getQuizStatementsByQuestionId").mockResolvedValue([
      {
        id: MOCK_STATEMENT_ID,
        question_id: MOCK_QUESTION_ID,
        text: "ATP is the main energy currency of biological cells.",
        is_true: true,
        grounding_rationale: "Directly supported by textbook section 3.2",
        display_order: 1,
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440006",
        question_id: MOCK_QUESTION_ID,
        text: "Cells consume glucose directly without converting it to ATP.",
        is_true: false,
        grounding_rationale: "False lie statement",
        display_order: 2,
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440007",
        question_id: MOCK_QUESTION_ID,
        text: "Mitochondria produce light energy instead of chemical energy.",
        is_true: false,
        grounding_rationale: "False lie statement",
        display_order: 3,
      },
    ]);

    // 3. Mock RAG evidence selection
    const mockEvidenceResult: evidenceService.EvidenceResult = {
      chunk_id: MOCK_CHUNK_ID,
      document_id: MOCK_DOC_ID,
      text: "ATP is the primary energy currency of biological cells.",
      similarity_score: 0.92,
      page_start: 4,
      page_end: 4,
      paragraph_start: 2,
      paragraph_end: 2,
      sentence_start: 1,
      sentence_end: 2,
      heading: "3.2 Energy Cycle",
      is_origin_chunk: true,
    };

    vi.spyOn(evidenceService, "selectEvidenceForQuestion").mockResolvedValue(
      mockEvidenceResult
    );

    const updateSpy = vi.spyOn(sessionDb, "updateAnswerEvidenceViewed").mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440088",
      session_id: MOCK_SESSION_ID,
      question_id: MOCK_QUESTION_ID,
      selected_statement_ids: ["550e8400-e29b-41d4-a716-446655440006"],
      is_correct: false,
      confidence_level: 4,
      evidence_viewed: true,
      answered_at: new Date().toISOString(),
    });

    // Execute POST /api/evidence
    const request = new Request("http://localhost/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: MOCK_SESSION_ID,
        questionId: MOCK_QUESTION_ID,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.evidence).toEqual(mockEvidenceResult);

    // Assert that updateAnswerEvidenceViewed was called to track interaction
    expect(updateSpy).toHaveBeenCalledWith(MOCK_SESSION_ID, MOCK_QUESTION_ID, true);
  });

  it("returns 400 Bad Request on invalid request payload", async () => {
    const request = new Request("http://localhost/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "invalid-uuid",
        questionId: MOCK_QUESTION_ID,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 Not Found when session does not exist", async () => {
    vi.spyOn(sessionDb, "getSessionById").mockRejectedValue(
      new NotFoundError("Session not found")
    );

    const request = new Request("http://localhost/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: MOCK_SESSION_ID,
        questionId: MOCK_QUESTION_ID,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 422 Unprocessable Entity when evidence selection fails due to insufficient evidence", async () => {
    vi.spyOn(sessionDb, "getSessionById").mockResolvedValue({
      id: MOCK_SESSION_ID,
      document_id: MOCK_DOC_ID,
      session_token: "550e8400-e29b-41d4-a716-446655440099",
      mode: "identify_truth",
      created_at: new Date().toISOString(),
    });

    vi.spyOn(quizDb, "getQuizQuestionById").mockResolvedValue({
      id: MOCK_QUESTION_ID,
      document_id: MOCK_DOC_ID,
      concept: "Cellular Energy",
      difficulty: "foundational",
      grounding_chunk_ids: [MOCK_CHUNK_ID],
      generation_provider: "openai",
      generation_model: "gpt-4o",
      generation_attempts: 1,
      created_at: new Date().toISOString(),
    });

    vi.spyOn(quizDb, "getQuizStatementsByQuestionId").mockResolvedValue([
      {
        id: MOCK_STATEMENT_ID,
        question_id: MOCK_QUESTION_ID,
        text: "ATP is the main energy currency.",
        is_true: true,
        grounding_rationale: "Test rationale",
        display_order: 1,
      },
    ]);

    vi.spyOn(evidenceService, "selectEvidenceForQuestion").mockRejectedValue(
      new InsufficientEvidenceError("No chunk met threshold")
    );

    const request = new Request("http://localhost/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: MOCK_SESSION_ID,
        questionId: MOCK_QUESTION_ID,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("INSUFFICIENT_EVIDENCE");
  });
});
