import { GapAnswerInput } from "@/lib/confidence/gap";

export const CONFIDENCE_GAP_ALERT_HEADER = "Confidence–Accuracy Gap Detected";

export const CONFIDENCE_GAP_ALERT_COPY =
  "Your recent answers show a significant confidence-accuracy gap — you've been very confident on several questions you got wrong. Consider slowing down and rereading the source evidence before your next answer.";

export const FORBIDDEN_DIAGNOSTIC_TERMS = [
  "dunning-kruger",
  "diagnos",
  "disorder",
];

/**
 * Determines whether the confidence gap alert should be triggered.
 * Triggers when over 60% of trailing N=5 answers (>= 3 of last 5) are high-confidence (>=4) and incorrect.
 */
export function shouldTriggerConfidenceGapAlert(
  answers: GapAnswerInput[],
  windowSize = 5
): boolean {
  if (answers.length === 0) {
    return false;
  }

  const trailing = answers.slice(-windowSize);
  const overconfidenceCount = trailing.filter(
    (a) => a.confidence_level >= 4 && !a.is_correct
  ).length;

  const overconfidenceRate = overconfidenceCount / trailing.length;
  return overconfidenceRate >= 0.6;
}

/**
 * Guardrail check asserting that copy text contains zero disallowed diagnostic terms (AC-CONF-5b).
 */
export function assertGuardrailedLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_DIAGNOSTIC_TERMS) {
    if (lower.includes(term)) {
      return false;
    }
  }
  return true;
}
