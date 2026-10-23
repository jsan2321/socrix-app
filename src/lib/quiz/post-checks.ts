import { DevilsAdvocateQuestion } from "@/schemas/quiz";

export interface PostCheckResult {
  valid: boolean;
  errors: string[];
}

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "he", "in", "is", "it", "its", "of", "on", "that", "the",
  "to", "was", "were", "will", "with", "this", "these", "those", "or",
  "an", "but", "if", "not", "than", "each", "which", "how", "what", "when"
]);

/**
 * Normalizes a word to its basic stem (simple heuristic: lowercased 5-char prefix).
 */
function stemWord(word: string): string {
  const w = word.toLowerCase().replace(/(ing|ed|es|s)$/, "");
  return w.length >= 4 ? w.slice(0, 5) : w;
}

function extractStems(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words.map(stemWord));
}

function extractRawWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

function calculateJaccardSimilarity(textA: string, textB: string): number {
  const wordsA = extractRawWords(textA);
  const wordsB = extractRawWords(textB);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      intersection++;
    }
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Executes deterministic non-LLM quality validation after generation.
 */
export function validatePostGenerationChecks(
  generated: DevilsAdvocateQuestion,
  sourceText: string
): PostCheckResult {
  const errors: string[] = [];

  // Check 1: Exactly 1 true statement
  const trueCount = generated.statements.filter((s) => s.isTrue).length;
  if (trueCount !== 1) {
    errors.push(`Expected exactly 1 true statement, got ${trueCount}`);
  }

  // Segment source sentences
  const sourceSentences = sourceText
    .split(/[.!?]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  // Check 2: Verbatim n-gram / substring overlap check
  for (let i = 0; i < generated.statements.length; i++) {
    const stText = generated.statements[i].text.toLowerCase();
    for (const srcSentence of sourceSentences) {
      if (srcSentence.length > 25) {
        const sim = calculateJaccardSimilarity(stText, srcSentence);
        const isSubstring = stText.includes(srcSentence) || srcSentence.includes(stText);
        if (sim >= 0.85 || isSubstring) {
          errors.push(
            `Statement ${i + 1} has >= 90% verbatim similarity with source sentence: "${srcSentence.slice(0, 50)}..."`
          );
          break;
        }
      }
    }
  }

  // Check 3: Near-duplicate check between statement pairs
  for (let i = 0; i < generated.statements.length; i++) {
    for (let j = i + 1; j < generated.statements.length; j++) {
      const sim = calculateJaccardSimilarity(
        generated.statements[i].text.toLowerCase(),
        generated.statements[j].text.toLowerCase()
      );
      if (sim >= 0.85) {
        errors.push(
          `Statements ${i + 1} and ${j + 1} are near-duplicates (Jaccard similarity ${sim.toFixed(2)})`
        );
      }
    }
  }

  // Check 4: Grounding rationale vocabulary stem overlap with source text
  const sourceStems = extractStems(sourceText);
  for (let i = 0; i < generated.statements.length; i++) {
    const rationaleStems = extractStems(generated.statements[i].groundingRationale);
    let overlapCount = 0;
    for (const stem of rationaleStems) {
      if (sourceStems.has(stem)) {
        overlapCount++;
      }
    }
    if (overlapCount < 2) {
      errors.push(
        `Statement ${i + 1} grounding rationale has insufficient vocabulary overlap with source passage (found ${overlapCount} matching words, min 2 required)`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
