import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildSessionExportData,
  getCalibrationAssessment,
  getQuestionDiagnostic,
  getCertaintyLabel,
  formatShareableSummary,
  SessionExportDataSchema,
  type RawAnswerForExport,
} from "@/lib/export/results-card";
import { GET } from "@/app/api/sessions/[id]/export/route";
import * as sessionDb from "@/lib/db/sessions";
import * as documentDb from "@/lib/db/documents";

const MOCK_SESSION_ID = "550e8400-e29b-41d4-a716-446655440001";
const MOCK_DOC_ID = "550e8400-e29b-41d4-a716-446655440002";

vi.mock("@/lib/db/sessions");
vi.mock("@/lib/db/documents");
vi.mock("@/lib/db/client", () => ({
  getSupabaseAdminClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        in: () => Promise.resolve({ data: [] }),
      }),
    }),
  }),
}));

describe("Results Export & Ubiquitous Language Module", () => {
  describe("Calibration Assessment (getCalibrationAssessment)", () => {
    it("maps low rolling gap (<0.20) to Spot-On Calibration", () => {
      const assessment = getCalibrationAssessment(0.12);
      expect(assessment.tier).toBe("spot_on");
      expect(assessment.label).toBe("Spot-On Calibration");
      expect(assessment.description).toContain("minimal illusion");
    });

    it("maps moderate rolling gap (0.20-0.35) to Good Alignment", () => {
      const assessment = getCalibrationAssessment(0.28);
      expect(assessment.tier).toBe("good");
      expect(assessment.label).toBe("Good Alignment");
    });

    it("maps high rolling gap (>0.35) to Calibration Gap", () => {
      const assessment = getCalibrationAssessment(0.48);
      expect(assessment.tier).toBe("needs_alignment");
      expect(assessment.label).toBe("Calibration Gap");
      expect(assessment.description).toContain("blind spots");
    });
  });

  describe("Question Diagnostics (getQuestionDiagnostic)", () => {
    it("categorizes high certainty + correct as 'mastered'", () => {
      const diag = getQuestionDiagnostic(true, 5);
      expect(diag.diagnostic).toBe("mastered");
      expect(diag.label).toBe("Mastered");
    });

    it("categorizes high certainty + incorrect as 'blind_spot'", () => {
      const diag = getQuestionDiagnostic(false, 4);
      expect(diag.diagnostic).toBe("blind_spot");
      expect(diag.label).toBe("Blind Spot");
      expect(diag.description).toContain("Illusion of competence");
    });

    it("categorizes low certainty + correct as 'hidden_strength'", () => {
      const diag = getQuestionDiagnostic(true, 2);
      expect(diag.diagnostic).toBe("hidden_strength");
      expect(diag.label).toBe("Hidden Strength");
      expect(diag.description).toContain("self-doubt");
    });

    it("categorizes low certainty + incorrect as 'needs_review'", () => {
      const diag = getQuestionDiagnostic(false, 1);
      expect(diag.diagnostic).toBe("needs_review");
      expect(diag.label).toBe("Needs Review");
    });
  });

  describe("Certainty Labels (getCertaintyLabel)", () => {
    it("translates discrete confidence levels to human-first certainty terms", () => {
      expect(getCertaintyLabel(1)).toBe("Wild Guess");
      expect(getCertaintyLabel(2)).toBe("Unsure Hunch");
      expect(getCertaintyLabel(3)).toBe("Fairly Sure");
      expect(getCertaintyLabel(4)).toBe("Confident");
      expect(getCertaintyLabel(5)).toBe("Certain");
    });
  });

  describe("Session Export Serialization (buildSessionExportData)", () => {
    const mockAnswers: RawAnswerForExport[] = [
      {
        id: "ans-1",
        question_id: "q-1",
        is_correct: true,
        confidence_level: 5,
        evidence_viewed: false,
        answered_at: new Date().toISOString(),
        concept: "Cellular Respiration",
        grounding_rationale: "ATP synthesis occurs in mitochondria.",
        source_excerpt: "Section 4.1: Energy transfers in cellular respiration.",
      },
      {
        id: "ans-2",
        question_id: "q-2",
        is_correct: false,
        confidence_level: 4,
        evidence_viewed: true,
        answered_at: new Date().toISOString(),
        concept: "Krebs Cycle",
        grounding_rationale: "Acetyl-CoA combines with oxaloacetate.",
      },
      {
        id: "ans-3",
        question_id: "q-3",
        is_correct: true,
        confidence_level: 2,
        evidence_viewed: false,
        answered_at: new Date().toISOString(),
        concept: "Glycolysis",
      },
      {
        id: "ans-4",
        question_id: "q-4",
        is_correct: true,
        confidence_level: 4,
        evidence_viewed: false,
        answered_at: new Date().toISOString(),
        concept: "Oxidative Phosphorylation",
      },
    ];

    it("computes mastery score, diagnostic counts, and passes schema validation", () => {
      const exportData = buildSessionExportData({
        sessionId: MOCK_SESSION_ID,
        documentTitle: "Bioenergetics Textbook",
        createdAt: "2026-09-29T12:00:00Z",
        mode: "identify_truth",
        rollingGap: 0.15,
        answers: mockAnswers,
        shareUrl: "https://example.com/share/test",
      });

      // Validates against runtime Zod schema
      expect(() => SessionExportDataSchema.parse(exportData)).not.toThrow();

      // Mastery: 3 / 4 = 75%
      expect(exportData.metrics.masteryPercentage).toBe(75);
      expect(exportData.metrics.totalAnswered).toBe(4);
      expect(exportData.metrics.correctCount).toBe(3);

      // Calibration: rollingGap = 0.15 -> spot_on
      expect(exportData.metrics.calibrationTier).toBe("spot_on");
      expect(exportData.metrics.calibrationLabel).toBe("Spot-On Calibration");

      // Diagnostics: 1 blind spot (ans-2), 1 hidden strength (ans-3), 1 evidence consulted (ans-2)
      expect(exportData.metrics.blindSpotsCount).toBe(1);
      expect(exportData.metrics.hiddenStrengthsCount).toBe(1);
      expect(exportData.metrics.evidenceConsultedCount).toBe(1);

      // Question breakdown
      expect(exportData.questions).toHaveLength(4);
      expect(exportData.questions[0].diagnostic).toBe("mastered");
      expect(exportData.questions[1].diagnostic).toBe("blind_spot");
      expect(exportData.questions[2].diagnostic).toBe("hidden_strength");
      expect(exportData.questions[3].diagnostic).toBe("mastered");
    });

    it("strictly sanitizes data and never includes user_id or internal auth credentials", () => {
      const exportData = buildSessionExportData({
        sessionId: MOCK_SESSION_ID,
        documentTitle: "Bioenergetics Textbook",
        createdAt: "2026-09-29T12:00:00Z",
        mode: "identify_truth",
        rollingGap: 0.15,
        answers: mockAnswers,
      });

      const serialized = JSON.stringify(exportData);
      expect(serialized).not.toContain("user_id");
      expect(serialized).not.toContain("user_email");
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("token");
    });

    it("formats an engaging, plain-text shareable summary without jargon", () => {
      const summary = formatShareableSummary({
        documentTitle: "Quantum Mechanics Fundamentals",
        masteryPercentage: 80,
        correctCount: 4,
        totalAnswered: 5,
        calibrationLabel: "Spot-On Calibration",
        blindSpotsCount: 0,
        hiddenStrengthsCount: 1,
        evidenceConsultedCount: 2,
        shareUrl: "https://socrix.vercel.app/share/123",
      });

      expect(summary).toContain("Mastery Score: 80%");
      expect(summary).toContain("Spot-On Calibration");
      expect(summary).toContain("Blind Spots (Illusions of Competence): 0");
      expect(summary).toContain("Hidden Strengths (Doubted but Correct): 1");
      expect(summary).toContain("https://socrix.vercel.app/share/123");
      // Must not contain raw mathematical variable names
      expect(summary).not.toContain("rollingGap");
      expect(summary).not.toContain("overconfidenceRate");
    });
  });

  describe("GET /api/sessions/[id]/export Route Handler", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.AUTH_TEST_BYPASS = "true";
    });

    it("returns 200 with complete JSON study dossier", async () => {
      vi.spyOn(sessionDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: MOCK_DOC_ID,
        session_token: "550e8400-e29b-41d4-a716-446655440099",
        mode: "identify_truth",
        created_at: new Date().toISOString(),
      });

      vi.spyOn(documentDb, "getDocumentById").mockResolvedValue({
        id: MOCK_DOC_ID,
        title: "Introduction to Cognitive Science",
        content_hash: "hash_cog",
        status: "ready",
        failure_reason: null,
        page_count: 15,
        chunks_total: 8,
        chunks_embedded_count: 8,
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
          concept: "Working Memory Capacity",
        },
      ]);

      const req = new Request(`http://localhost/api/sessions/${MOCK_SESSION_ID}/export`);
      const res = await GET(req, { params: Promise.resolve({ id: MOCK_SESSION_ID }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.sessionId).toBe(MOCK_SESSION_ID);
      expect(body.documentTitle).toBe("Introduction to Cognitive Science");
      expect(body.metrics.masteryPercentage).toBe(100);
      expect(body.metrics.calibrationTier).toBe("spot_on");
      expect(body.questions).toHaveLength(1);
      expect(body.questions[0].diagnostic).toBe("mastered");
    });

    it("sets attachment Content-Disposition header when download=true", async () => {
      vi.spyOn(sessionDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: MOCK_DOC_ID,
        session_token: "550e8400-e29b-41d4-a716-446655440099",
        mode: "identify_truth",
        created_at: new Date().toISOString(),
      });

      vi.spyOn(documentDb, "getDocumentById").mockResolvedValue({
        id: MOCK_DOC_ID,
        title: "Test Document",
        content_hash: "h",
        status: "ready",
        failure_reason: null,
        chunks_embedded_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      vi.spyOn(sessionDb, "getSessionAnswersWithQuestions").mockResolvedValue([]);

      const req = new Request(`http://localhost/api/sessions/${MOCK_SESSION_ID}/export?download=true`);
      const res = await GET(req, { params: Promise.resolve({ id: MOCK_SESSION_ID }) });

      expect(res.status).toBe(200);
      const disposition = res.headers.get("content-disposition");
      expect(disposition).toContain(`attachment; filename="socratic-dossier-${MOCK_SESSION_ID}.json"`);
    });

    it("returns plain text when format=text", async () => {
      vi.spyOn(sessionDb, "getSessionById").mockResolvedValue({
        id: MOCK_SESSION_ID,
        document_id: MOCK_DOC_ID,
        session_token: "550e8400-e29b-41d4-a716-446655440099",
        mode: "identify_truth",
        created_at: new Date().toISOString(),
      });

      vi.spyOn(documentDb, "getDocumentById").mockResolvedValue({
        id: MOCK_DOC_ID,
        title: "Plain Text Document",
        content_hash: "h",
        status: "ready",
        failure_reason: null,
        chunks_embedded_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      vi.spyOn(sessionDb, "getSessionAnswersWithQuestions").mockResolvedValue([]);

      const req = new Request(`http://localhost/api/sessions/${MOCK_SESSION_ID}/export?format=text`);
      const res = await GET(req, { params: Promise.resolve({ id: MOCK_SESSION_ID }) });
      const text = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/plain");
      expect(text).toContain("Socratic Cross-Examiner — Study Session Dossier");
      expect(text).toContain("Plain Text Document");
    });

    it("rejects invalid UUID formats with 400", async () => {
      const req = new Request("http://localhost/api/sessions/invalid-uuid/export");
      const res = await GET(req, { params: Promise.resolve({ id: "invalid-uuid" }) });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });
});
