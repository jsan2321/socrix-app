import { z } from "zod";

/**
 * Qualitative calibration tiers representing learner self-awareness.
 * Replaces cold mathematical rolling gap decimals with actionable domain categories.
 */
export type CalibrationTier = "spot_on" | "good" | "needs_alignment";

/**
 * Diagnostic categorization for each answered concept.
 * Highlights illusions of competence vs. genuine retention.
 */
export type QuestionDiagnostic =
  | "mastered"
  | "blind_spot"
  | "hidden_strength"
  | "needs_review";

export interface DiagnosticInfo {
  tier: CalibrationTier;
  label: string;
  description: string;
}

/**
 * Maps a numerical rolling gap (0.0 - 1.0) to an intuitive self-awareness assessment.
 */
export function getCalibrationAssessment(rollingGap: number): DiagnosticInfo {
  if (rollingGap < 0.2) {
    return {
      tier: "spot_on",
      label: "Spot-On Calibration",
      description: "Your confidence accurately reflects your true recall with minimal illusion.",
    };
  }
  if (rollingGap <= 0.35) {
    return {
      tier: "good",
      label: "Good Alignment",
      description: "Strong self-awareness with occasional hesitation on complex details.",
    };
  }
  return {
    tier: "needs_alignment",
    label: "Calibration Gap",
    description: "High certainty on misconceptions detected — review source evidence to unmask blind spots.",
  };
}

/**
 * Categorizes an answered concept into a learner-first diagnostic outcome.
 */
export function getQuestionDiagnostic(
  isCorrect: boolean,
  confidenceLevel: number
): { diagnostic: QuestionDiagnostic; label: string; description: string } {
  const roundedConf = Math.max(1, Math.min(5, Math.round(confidenceLevel)));

  if (isCorrect) {
    if (roundedConf >= 4) {
      return {
        diagnostic: "mastered",
        label: "Mastered",
        description: "High certainty backed by accurate recall.",
      };
    }
    return {
      diagnostic: "hidden_strength",
      label: "Hidden Strength",
      description: "Correctly recalled despite self-doubt or second-guessing.",
    };
  }

  // Incorrect answer
  if (roundedConf >= 4) {
    return {
      diagnostic: "blind_spot",
      label: "Blind Spot",
      description: "Illusion of competence — felt confident, but misled by plausible distractor.",
    };
  }

  return {
    diagnostic: "needs_review",
    label: "Needs Review",
    description: "Honest uncertainty on an unfamiliar or tricky concept.",
  };
}

/**
 * Translates discrete confidence levels (1–5) to intuitive learner certainty terms.
 */
export function getCertaintyLabel(level: number): string {
  switch (Math.round(level)) {
    case 1:
      return "Wild Guess";
    case 2:
      return "Unsure Hunch";
    case 3:
      return "Fairly Sure";
    case 4:
      return "Confident";
    case 5:
      return "Certain";
    default:
      return "Unrated";
  }
}

export const QuestionExportSummarySchema = z.object({
  index: z.number().int().positive(),
  concept: z.string(),
  diagnostic: z.enum(["mastered", "blind_spot", "hidden_strength", "needs_review"]),
  diagnosticLabel: z.string(),
  diagnosticDescription: z.string(),
  isCorrect: z.boolean(),
  certaintyLevel: z.number().int().min(1).max(5),
  certaintyLabel: z.string(),
  evidenceViewed: z.boolean(),
  groundingRationale: z.string().nullable().optional(),
  sourceExcerpt: z.string().nullable().optional(),
});

export const LearnerMetricsSchema = z.object({
  masteryPercentage: z.number().min(0).max(100),
  totalAnswered: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  calibrationTier: z.enum(["spot_on", "good", "needs_alignment"]),
  calibrationLabel: z.string(),
  calibrationDescription: z.string(),
  blindSpotsCount: z.number().int().min(0),
  hiddenStrengthsCount: z.number().int().min(0),
  evidenceConsultedCount: z.number().int().min(0),
  averageCertainty: z.number().min(1).max(5),
  rawRollingGap: z.number().min(0).max(1),
});

export const SessionExportDataSchema = z.object({
  sessionId: z.string().uuid(),
  documentTitle: z.string(),
  completedAt: z.string(),
  formattedDate: z.string(),
  mode: z.enum(["identify_truth", "identify_both_lies"]),
  metrics: LearnerMetricsSchema,
  questions: z.array(QuestionExportSummarySchema),
  shareableSummaryText: z.string(),
  metadata: z.object({
    exportedAt: z.string(),
    generator: z.string(),
    version: z.string(),
  }),
});

export type QuestionExportSummary = z.infer<typeof QuestionExportSummarySchema>;
export type LearnerMetrics = z.infer<typeof LearnerMetricsSchema>;
export type SessionExportData = z.infer<typeof SessionExportDataSchema>;

export interface RawAnswerForExport {
  id: string;
  question_id: string;
  is_correct: boolean;
  confidence_level: number;
  evidence_viewed: boolean;
  answered_at: string;
  concept: string;
  grounding_rationale?: string | null;
  source_excerpt?: string | null;
}

export interface BuildSessionExportInput {
  sessionId: string;
  documentTitle: string;
  createdAt: string;
  mode: "identify_truth" | "identify_both_lies";
  rollingGap: number;
  answers: RawAnswerForExport[];
  shareUrl?: string;
}

/**
 * Builds a sanitized, human-first session export data structure.
 * Strips all internal user IDs, auth details, and sensitive system parameters.
 */
export function buildSessionExportData(input: BuildSessionExportInput): SessionExportData {
  const { sessionId, documentTitle, createdAt, mode, rollingGap, answers, shareUrl } = input;

  const totalAnswered = answers.length;
  const correctCount = answers.filter((a) => a.is_correct).length;
  const masteryPercentage = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  const calibration = getCalibrationAssessment(rollingGap);

  let blindSpotsCount = 0;
  let hiddenStrengthsCount = 0;
  let evidenceConsultedCount = 0;
  let totalConfidenceSum = 0;

  const questions: QuestionExportSummary[] = answers.map((ans, idx) => {
    const diag = getQuestionDiagnostic(ans.is_correct, ans.confidence_level);
    if (diag.diagnostic === "blind_spot") blindSpotsCount += 1;
    if (diag.diagnostic === "hidden_strength") hiddenStrengthsCount += 1;
    if (ans.evidence_viewed) evidenceConsultedCount += 1;
    totalConfidenceSum += ans.confidence_level;

    return {
      index: idx + 1,
      concept: ans.concept,
      diagnostic: diag.diagnostic,
      diagnosticLabel: diag.label,
      diagnosticDescription: diag.description,
      isCorrect: ans.is_correct,
      certaintyLevel: Math.max(1, Math.min(5, Math.round(ans.confidence_level))),
      certaintyLabel: getCertaintyLabel(ans.confidence_level),
      evidenceViewed: ans.evidence_viewed,
      groundingRationale: ans.grounding_rationale ?? null,
      sourceExcerpt: ans.source_excerpt ?? null,
    };
  });

  const averageCertainty = totalAnswered > 0 ? Number((totalConfidenceSum / totalAnswered).toFixed(1)) : 3;

  const metrics: LearnerMetrics = {
    masteryPercentage,
    totalAnswered,
    correctCount,
    calibrationTier: calibration.tier,
    calibrationLabel: calibration.label,
    calibrationDescription: calibration.description,
    blindSpotsCount,
    hiddenStrengthsCount,
    evidenceConsultedCount,
    averageCertainty,
    rawRollingGap: Number(rollingGap.toFixed(2)),
  };

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const shareableSummaryText = formatShareableSummary({
    documentTitle,
    masteryPercentage,
    correctCount,
    totalAnswered,
    calibrationLabel: calibration.label,
    blindSpotsCount,
    hiddenStrengthsCount,
    evidenceConsultedCount,
    shareUrl,
  });

  return SessionExportDataSchema.parse({
    sessionId,
    documentTitle,
    completedAt: createdAt,
    formattedDate,
    mode,
    metrics,
    questions,
    shareableSummaryText,
    metadata: {
      exportedAt: new Date().toISOString(),
      generator: "Socratic Cross-Examiner",
      version: "0.1.0",
    },
  });
}

export interface FormatSummaryInput {
  documentTitle: string;
  masteryPercentage: number;
  correctCount: number;
  totalAnswered: number;
  calibrationLabel: string;
  blindSpotsCount: number;
  hiddenStrengthsCount: number;
  evidenceConsultedCount: number;
  shareUrl?: string;
}

/**
 * Creates an engaging, user-friendly plain-text card for social / clipboard sharing.
 */
export function formatShareableSummary(input: FormatSummaryInput): string {
  const lines: string[] = [
    `🎯 Socratic Cross-Examiner — Study Session Dossier`,
    `📖 Source: ${input.documentTitle}`,
    `🏆 Mastery Score: ${input.masteryPercentage}% (${input.correctCount} of ${input.totalAnswered} concepts retained)`,
    `🧠 Self-Awareness: ${input.calibrationLabel}`,
    `🔍 Insights:`,
    `   • Blind Spots (Illusions of Competence): ${input.blindSpotsCount}`,
    `   • Hidden Strengths (Doubted but Correct): ${input.hiddenStrengthsCount}`,
    `   • Source Evidence Inquiries: ${input.evidenceConsultedCount}`,
  ];

  if (input.shareUrl) {
    lines.push(`🔗 Review Session Dossier: ${input.shareUrl}`);
  }

  return lines.join("\n");
}
