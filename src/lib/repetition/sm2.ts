/**
 * Spaced Repetition Engine (SuperMemo-2 / SM-2 adapted for Confidence Calibration)
 *
 * Translates answer correctness and metacognitive confidence into optimal review intervals.
 */

export type RetentionStatus = "needs_review" | "strengthening" | "retained" | "mastered";

export interface Sm2Input {
  repetitionCount: number;
  intervalDays: number;
  easeFactor: number;
  quality: number; // 0 to 5
}

export interface Sm2Result {
  repetitionCount: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: Date;
  status: RetentionStatus;
}

/**
 * Maps answer correctness and stated confidence level (1-5) into an SM-2 quality grade (0-5).
 */
export function calculateQualityFromAnswer(isCorrect: boolean, confidenceLevel: number): number {
  if (!isCorrect) {
    // High confidence on incorrect answer = Blind Spot (severe misconception)
    if (confidenceLevel >= 4) {
      return 1;
    }
    // Moderate or low confidence on incorrect answer = Aware of uncertainty
    return 2;
  }

  // Correct answers:
  if (confidenceLevel <= 2) {
    // Low confidence correct = Hunch or lucky guess
    return 3;
  }
  if (confidenceLevel === 3) {
    // Moderate confidence
    return 4;
  }
  // High confidence correct = Mastered recall
  return 5;
}

/**
 * Calculates next review interval, ease factor, and repetition count using SM-2.
 */
export function calculateSm2(input: Sm2Input, baseDate: Date = new Date()): Sm2Result {
  const { repetitionCount, intervalDays, easeFactor, quality } = input;
  const clampedQuality = Math.max(0, Math.min(5, Math.round(quality)));

  let nextRepetitionCount = repetitionCount;
  let nextIntervalDays = intervalDays;

  if (clampedQuality < 3) {
    // Concept failed — reset interval to 1 day and repetition count to 0
    nextRepetitionCount = 0;
    nextIntervalDays = 1;
  } else {
    // Concept retained
    if (repetitionCount === 0) {
      nextIntervalDays = 1;
    } else if (repetitionCount === 1) {
      nextIntervalDays = 6;
    } else {
      nextIntervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
    nextRepetitionCount += 1;
  }

  // Update ease factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const qDiff = 5 - clampedQuality;
  const newEaseFactor = easeFactor + (0.1 - qDiff * (0.08 + qDiff * 0.02));
  const clampedEaseFactor = Math.max(1.3, Number(newEaseFactor.toFixed(2)));

  // Calculate next review date
  const nextReviewAt = new Date(baseDate.getTime());
  nextReviewAt.setDate(nextReviewAt.getDate() + nextIntervalDays);

  // Derive human-centric status
  let status: RetentionStatus = "needs_review";
  if (clampedQuality < 3) {
    status = "needs_review";
  } else if (nextIntervalDays < 6) {
    status = "strengthening";
  } else if (nextIntervalDays < 21) {
    status = "retained";
  } else {
    status = "mastered";
  }

  return {
    repetitionCount: nextRepetitionCount,
    intervalDays: nextIntervalDays,
    easeFactor: clampedEaseFactor,
    nextReviewAt,
    status,
  };
}
