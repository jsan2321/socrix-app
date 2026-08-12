import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeConfidence,
  computePerAnswerGap,
  computeRollingGap,
} from "@/lib/confidence/gap";
import { buildConfidenceTracerData } from "@/lib/confidence/tracer";
import {
  shouldTriggerConfidenceGapAlert,
  assertGuardrailedLanguage,
  CONFIDENCE_GAP_ALERT_COPY,
  CONFIDENCE_GAP_ALERT_HEADER,
} from "@/lib/confidence/alert";
import { GET } from "@/app/api/sessions/[id]/results/route";
import * as sessionDb from "@/lib/db/sessions";
import * as documentDb from "@/lib/db/documents";

const MOCK_SESSION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MOCK_DOC_ID = "550e8400-e29b-41d4-a716-446655440002";

vi.mock("@/lib/db/sessions");
vi.mock("@/lib/db/documents");

describe("Confidence Module & Gap Engine (Phase 8)", () => {
  describe("Gap Calculations (gap.ts)", () => {
    it("normalizes confidence level from 1-5 scale to 0.0-1.0", () => {
      expect(normalizeConfidence(1)).toBe(0.0);
      expect(normalizeConfidence(3)).toBe(0.5);
      expect(normalizeConfidence(5)).toBe(1.0);
    });

    it("computes per-answer gap correctly for overconfidence, underconfidence, and calibration", () => {
      // Overconfident: confident (5) but wrong (false) -> +1.0
      expect(computePerAnswerGap(5, false)).toBe(1.0);
      // Underconfident: unsure (1) but correct (true) -> -1.0
      expect(computePerAnswerGap(1, true)).toBe(-1.0);
      // Calibrated: confident (5) and correct (true) -> 0.0
      expect(computePerAnswerGap(5, true)).toBe(0.0);
    });

    it("produces rolling gap of exactly 1.0 for 5 consecutive confidence=5 incorrect answers (AC-CONF-3a)", () => {
      const answers = Array.from({ length: 5 }, () => ({
        confidence_level: 5,
        is_correct: false,
      }));

      const rollingGap = computeRollingGap(answers, 5);
      expect(rollingGap).toBe(1.0);
    });
  });

  describe("Tracer Data Aggregation (tracer.ts)", () => {
    it("builds tracer points with length matching total answered questions (AC-CONF-4a)", () => {
      const answers: sessionDb.SessionAnswerWithConcept[] = [
        {
          id: "ans-1",
          session_id: MOCK_SESSION_ID,
          question_id: "q-1",
          selected_statement_ids: ["s-1"],
          is_correct: true,
          confidence_level: 5,
          evidence_viewed: false,
          answered_at: new Date().toISOString(),
          concept: "Photosynthesis",
        },
        {
          id: "ans-2",
          session_id: MOCK_SESSION_ID,
          question_id: "q-2",
          selected_statement_ids: ["s-2"],
          is_correct: false,
          confidence_level: 4,
          evidence_viewed: true,
          answered_at: new Date().toISOString(),
          concept: "Cellular Respiration",
        },
      ];

      const tracerData = buildConfidenceTracerData(answers);

      expect(tracerData.points).toHaveLength(2);
      expect(tracerData.points[0].questionConcept).toBe("Photosynthesis");
      expect(tracerData.points[0].correct).toBe(true);
      expect(tracerData.points[0].usedEvidence).toBe(false);
      expect(tracerData.points[1].usedEvidence).toBe(true);
      expect(tracerData.overconfidenceRate).toBe(0.5); // 1 of 2 is conf >= 4 and incorrect
      expect(tracerData.underconfidenceRate).toBe(0.0);
    });
  });

  describe("Confidence Gap Alert & Non-Diagnostic Guardrails (alert.ts)", () => {
    it("triggers alert when >= 3 of last 5 answers are confidence >= 4 and incorrect", () => {
      const triggeringAnswers = [
        { confidence_level: 5, is_correct: false },
        { confidence_level: 4, is_correct: false },
        { confidence_level: 5, is_correct: false },
        { confidence_level: 5, is_correct: true },
        { confidence_level: 5, is_correct: true },
      ];

      expect(shouldTriggerConfidenceGapAlert(triggeringAnswers)).toBe(true);
    });

    it("does NOT trigger alert when same accuracy occurs at lower confidence levels (AC-CONF-5a)", () => {
      const lowConfidenceAnswers = [
        { confidence_level: 2, is_correct: false },
        { confidence_level: 2, is_correct: false },
        { confidence_level: 2, is_correct: false },
        { confidence_level: 5, is_correct: true },
        { confidence_level: 5, is_correct: true },
      ];

      expect(shouldTriggerConfidenceGapAlert(lowConfidenceAnswers)).toBe(false);
    });

    it("asserts alert copy contains NO diagnostic language (AC-CONF-5b)", () => {
      expect(assertGuardrailedLanguage(CONFIDENCE_GAP_ALERT_HEADER)).toBe(true);
      expect(assertGuardrailedLanguage(CONFIDENCE_GAP_ALERT_COPY)).toBe(true);

      const copyLower = CONFIDENCE_GAP_ALERT_COPY.toLowerCase();
      expect(copyLower).not.toContain("dunning-kruger");
      expect(copyLower).not.toContain("diagnos");
      expect(copyLower).not.toContain("disorder");
    });
  });

  describe("GET /api/sessions/[id]/results Route Handler", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns complete SessionResultsResponse payload with status 200", async () => {
      vi.spyOn(sessionDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: MOCK_DOC_ID,
        session_token: "550e8400-e29b-41d4-a716-446655440099",
        mode: "identify_truth",
        created_at: new Date().toISOString(),
      });

      vi.spyOn(documentDb, "getDocumentById").mockResolvedValue({
        id: MOCK_DOC_ID,
        title: "Biology Textbook Chapter 4",
        content_hash: "hash123",
        status: "ready",
        failure_reason: null,
        page_count: 20,
        chunks_total: 10,
        chunks_embedded_count: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      vi.spyOn(sessionDb, "getSessionAnswersWithQuestions").mockResolvedValue([
        {
          id: "ans-1",
          session_id: MOCK_SESSION_ID,
          question_id: "q-1",
          selected_statement_ids: ["s-1"],
          is_correct: true,
          confidence_level: 5,
          evidence_viewed: false,
          answered_at: new Date().toISOString(),
          concept: "Cellular Respiration",
        },
      ]);

      const request = new Request(`http://localhost/api/sessions/${MOCK_SESSION_ID}/results`);
      const response = await GET(request, { params: Promise.resolve({ id: MOCK_SESSION_ID }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.sessionId).toBe(MOCK_SESSION_ID);
      expect(body.documentTitle).toBe("Biology Textbook Chapter 4");
      expect(body.totalAnswered).toBe(1);
      expect(body.accuracy).toBe(1.0);
      expect(body.confidenceTracer.points).toHaveLength(1);
      expect(body.confidenceGapAlert).toBe(false);
    });
  });
});
