import { describe, it, expect } from "vitest";
import { countTokens, truncateToTokenLength } from "@/utils/tokenize";

describe("Tokenize Utility", () => {
  it("should return 0 for empty strings", () => {
    expect(countTokens("")).toBe(0);
  });

  it("should count tokens correctly for text", () => {
    const text = "The Socratic Cross-Examiner AI-Powered Platform";
    const tokens = countTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it("should truncate text to specified token count", () => {
    const text = "This is a long sentence testing the tokenizer truncation capability.";
    const truncated = truncateToTokenLength(text, 4);
    expect(countTokens(truncated)).toBeLessThanOrEqual(4);
  });
});
