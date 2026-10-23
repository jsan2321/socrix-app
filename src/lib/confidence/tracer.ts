import { computeRollingGap } from "@/lib/confidence/gap";

export interface ConfidenceTracerPoint {
  answeredAt: string;
  questionConcept: string;
  confidenceLevel: 1 | 2 | 3 | 4 | 5;
  correct: boolean;
  usedEvidence: boolean;
}

export interface ConfidenceTracerData {
  points: ConfidenceTracerPoint[];
  rollingGap: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
}

export interface TracerAnswerInput {
  answered_at: string;
  concept: string;
  confidence_level: number;
  is_correct: boolean;
  evidence_viewed: boolean;
}

/**
 * Aggregates confidence data and summary rates from session answer history.
 */
export function buildConfidenceTracerData(
  answers: TracerAnswerInput[]
): ConfidenceTracerData {
  const points: ConfidenceTracerPoint[] = answers.map((a) => ({
    answeredAt: a.answered_at,
    questionConcept: a.concept,
    confidenceLevel: (Math.max(1, Math.min(5, Math.round(a.confidence_level))) as 1 | 2 | 3 | 4 | 5),
    correct: a.is_correct,
    usedEvidence: a.evidence_viewed,
  }));

  const total = answers.length;
  const rollingGap = computeRollingGap(answers, 5);

  if (total === 0) {
    return {
      points: [],
      rollingGap: 0,
      overconfidenceRate: 0,
      underconfidenceRate: 0,
    };
  }

  const overconfidenceCount = answers.filter(
    (a) => a.confidence_level >= 4 && !a.is_correct
  ).length;

  const underconfidenceCount = answers.filter(
    (a) => a.confidence_level <= 2 && a.is_correct
  ).length;

  return {
    points,
    rollingGap,
    overconfidenceRate: Number((overconfidenceCount / total).toFixed(4)),
    underconfidenceRate: Number((underconfidenceCount / total).toFixed(4)),
  };
}
