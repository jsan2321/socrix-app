export type DifficultyLevel = "foundational" | "intermediate" | "advanced";

/**
 * Calculates heuristic difficulty score for grounding text passage (FR-QUIZ-2).
 * Evaluates sentence length, technical vocabulary density, and numeric/formula presence.
 */
export function calculateDifficulty(text: string): DifficultyLevel {
  if (!text || text.trim().length === 0) {
    return "foundational";
  }

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 0);

  if (words.length === 0 || sentences.length === 0) {
    return "foundational";
  }

  // 1. Average sentence length (norm: 15-35 words)
  const avgSentenceLength = words.length / sentences.length;
  const sentenceScore = Math.min(Math.max((avgSentenceLength - 10) / 25, 0), 1);

  // 2. Technical vocabulary density (words > 8 chars)
  const longWords = words.filter((w) => w.length >= 9);
  const vocabScore = Math.min(longWords.length / words.length / 0.25, 1);

  // 3. Numeric / formula density
  const numericTokens = (text.match(/\b\d+(\.\d+)?%?\b/g) || []).length;
  const numericScore = Math.min(numericTokens / (words.length / 10), 1);

  // Weighted score
  const totalScore = sentenceScore * 0.4 + vocabScore * 0.4 + numericScore * 0.2;

  if (totalScore > 0.65) {
    return "advanced";
  } else if (totalScore > 0.35) {
    return "intermediate";
  } else {
    return "foundational";
  }
}
