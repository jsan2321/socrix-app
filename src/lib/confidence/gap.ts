/**
 * Confidence-accuracy gap calculations.
 */

/**
 * Normalizes a 1-5 confidence level to a 0.0-1.0 scale.
 * 1 -> 0.0 ("just guessing")
 * 3 -> 0.5
 * 5 -> 1.0 ("certain")
 */
export function normalizeConfidence(confidenceLevel: number): number {
  const clamped = Math.max(1, Math.min(5, Math.round(confidenceLevel)));
  return (clamped - 1) / 4;
}

/**
 * Computes per-answer confidence-accuracy gap.
 * positive -> overconfident (confident but wrong)
 * negative -> underconfident (unsure but correct)
 * 0.0 -> perfectly calibrated
 */
export function computePerAnswerGap(
  confidenceLevel: number,
  isCorrect: boolean
): number {
  const normalizedConfidence = normalizeConfidence(confidenceLevel);
  const accuracy = isCorrect ? 1 : 0;
  return normalizedConfidence - accuracy;
}

export interface GapAnswerInput {
  confidence_level: number;
  is_correct: boolean;
}

/**
 * Computes the rolling gap (mean absolute per-answer gap) over trailing N answers.
 */
export function computeRollingGap(
  answers: GapAnswerInput[],
  windowSize = 5
): number {
  if (answers.length === 0) {
    return 0;
  }

  const trailing = answers.slice(-windowSize);
  const sumAbsGaps = trailing.reduce((acc, ans) => {
    const gap = computePerAnswerGap(ans.confidence_level, ans.is_correct);
    return acc + Math.abs(gap);
  }, 0);

  const mean = sumAbsGaps / trailing.length;
  return Number(mean.toFixed(4));
}
