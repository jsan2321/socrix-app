import { getEncoding, Tiktoken } from "js-tiktoken";

let encoderInstance: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoderInstance) {
    encoderInstance = getEncoding("cl100k_base");
  }
  return encoderInstance;
}

/**
 * Counts the number of tokens in a text string using OpenAI's cl100k_base encoding.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  try {
    const encoder = getEncoder();
    return encoder.encode(text).length;
  } catch {
    // Fallback heuristic if tokenization fails (~4 chars per token)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Truncates text to a maximum token length.
 */
export function truncateToTokenLength(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) return "";
  try {
    const encoder = getEncoder();
    const tokens = encoder.encode(text);
    if (tokens.length <= maxTokens) return text;
    const truncatedTokens = tokens.slice(0, maxTokens);
    return encoder.decode(truncatedTokens);
  } catch {
    // Fallback heuristic (~4 chars per token)
    return text.slice(0, maxTokens * 4);
  }
}
