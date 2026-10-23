import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/sessions/[id]/answers/route";
import * as sessionsDb from "@/lib/db/sessions";
import * as quizDb from "@/lib/db/quiz";
import { ConflictError } from "@/lib/errors";

const MOCK_SESSION_ID = "550e8400-e29b-41d4-a716-446655440030";
const MOCK_QUESTION_ID = "550e8400-e29b-41d4-a716-446655440031";
const TRUE_STMT_ID = "550e8400-e29b-41d4-a716-446655440032";
const LIE_STMT_1_ID = "550e8400-e29b-41d4-a716-446655440033";
const LIE_STMT_2_ID = "550e8400-e29b-41d4-a716-446655440034";

vi.mock("@/lib/db/sessions");
vi.mock("@/lib/db/quiz");

describe("Integration: Session Answer Recording & Correctness Evaluation", () => {
  const mockStatements = [
    {
      id: TRUE_STMT_ID,
      question_id: MOCK_QUESTION_ID,
      text: "True statement text",
      is_true: true,
      grounding_rationale: "Grounding rationale",
      display_order: 1,
    },
    {
      id: LIE_STMT_1_ID,
      question_id: MOCK_QUESTION_ID,
      text: "First lie statement text",
      is_true: false,
      grounding_rationale: "Plausible lie 1",
      display_order: 2,
    },
    {
      id: LIE_STMT_2_ID,
      question_id: MOCK_QUESTION_ID,
      text: "Second lie statement text",
      is_true: false,
      grounding_rationale: "Plausible lie 2",
      display_order: 3,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(quizDb, "getQuizStatementsByQuestionId").mockResolvedValue(mockStatements);
    vi.spyOn(sessionsDb, "recordSessionAnswer").mockResolvedValue({
      id: "answer-123",
      session_id: MOCK_SESSION_ID,
      question_id: MOCK_QUESTION_ID,
      selected_statement_ids: [TRUE_STMT_ID],
      confidence_level: 4,
      is_correct: true,
      evidence_viewed: false,
      answered_at: new Date().toISOString(),
    });
  });

  describe("Identify the Truth Mode (identify_truth)", () => {
    beforeEach(() => {
      vi.spyOn(sessionsDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: "doc-123",
        session_token: "token-123",
        mode: "identify_truth",
        created_at: new Date().toISOString(),
      });
    });

    it("evaluates to correct when user selects the single true statement", async () => {
      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [TRUE_STMT_ID],
          confidenceLevel: 5,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.correct).toBe(true);
      expect(json.correctStatementIds).toEqual([TRUE_STMT_ID]);
      expect(sessionsDb.recordSessionAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: MOCK_SESSION_ID,
          questionId: MOCK_QUESTION_ID,
          isCorrect: true,
          confidenceLevel: 5,
        })
      );
    });

    it("evaluates to incorrect when user selects a false statement", async () => {
      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [LIE_STMT_1_ID],
          confidenceLevel: 4,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.correct).toBe(false);
      expect(json.correctStatementIds).toEqual([TRUE_STMT_ID]);
      expect(sessionsDb.recordSessionAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          isCorrect: false,
        })
      );
    });
  });

  describe("Identify Both Lies Mode (identify_both_lies)", () => {
    beforeEach(() => {
      vi.spyOn(sessionsDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: "doc-123",
        session_token: "token-123",
        mode: "identify_both_lies",
        created_at: new Date().toISOString(),
      });
    });

    it("evaluates to correct when user selects both lie statements", async () => {
      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [LIE_STMT_1_ID, LIE_STMT_2_ID],
          confidenceLevel: 4,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.correct).toBe(true);
      expect(json.correctStatementIds).toEqual([TRUE_STMT_ID]);
      expect(sessionsDb.recordSessionAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          isCorrect: true,
        })
      );
    });

    it("evaluates to incorrect when user selects one true statement and one lie", async () => {
      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [TRUE_STMT_ID, LIE_STMT_1_ID],
          confidenceLevel: 3,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.correct).toBe(false);
      expect(sessionsDb.recordSessionAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          isCorrect: false,
        })
      );
    });

    it("evaluates to incorrect when user selects only one statement in two-choice mode", async () => {
      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [LIE_STMT_1_ID],
          confidenceLevel: 3,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.correct).toBe(false);
    });
  });

  describe("Constraints & Error Scenarios", () => {
    it("returns 409 Conflict when duplicate answer submission occurs", async () => {
      vi.spyOn(sessionsDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: "doc-123",
        session_token: "token-123",
        mode: "identify_truth",
        created_at: new Date().toISOString(),
      });

      vi.spyOn(sessionsDb, "recordSessionAnswer").mockRejectedValue(
        new ConflictError("Answer already submitted for this question")
      );

      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [TRUE_STMT_ID],
          confidenceLevel: 4,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      expect(response.status).toBe(409);
    });

    it("returns 400 Bad Request when confidenceLevel is out of range", async () => {
      const req = new Request(`http://localhost:3000/api/sessions/${MOCK_SESSION_ID}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: MOCK_QUESTION_ID,
          selectedStatementIds: [TRUE_STMT_ID],
          confidenceLevel: 10,
        }),
      });

      const response = await POST(req, {
        params: Promise.resolve({ id: MOCK_SESSION_ID }),
      });
      expect(response.status).toBe(400);
    });
  });
});
