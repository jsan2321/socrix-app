import { describe, it, expect } from "vitest";
import { validatePostGenerationChecks } from "@/lib/quiz/post-checks";
import type { DevilsAdvocateQuestion } from "@/schemas/quiz";

describe("Deterministic Post-Generation Checks (FR-QUIZ-9)", () => {
  const sourceText =
    "Photosynthesis takes place in chloroplasts. Light energy drives the synthesis of ATP and NADPH across thylakoid membranes, providing essential energy for carbohydrate production.";

  const validQuestion: DevilsAdvocateQuestion = {
    concept: "Photosynthesis Locations",
    difficulty: "intermediate",
    statements: [
      {
        text: "Chloroplast thylakoid membranes host light-driven energy conversion yielding ATP and NADPH.",
        isTrue: true,
        groundingRationale: "Passage states light energy drives ATP and NADPH synthesis across thylakoid membranes.",
      },
      {
        text: "Chloroplast outer envelopes synthesize carbohydrates directly without needing light energy.",
        isTrue: false,
        groundingRationale: "Distorts passage claim by asserting carbohydrates synthesize without light energy.",
      },
      {
        text: "Mitochondrial matrix membranes are the sole location for light-driven ATP production.",
        isTrue: false,
        groundingRationale: "Falsely attributes reaction to mitochondria rather than chloroplast thylakoid membranes.",
      },
    ],
  };

  it("passes validation for well-grounded non-verbatim distinct statements", () => {
    const result = validatePostGenerationChecks(validQuestion, sourceText);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects statement that is a verbatim copy of a source sentence", () => {
    const verbatimQuestion: DevilsAdvocateQuestion = {
      ...validQuestion,
      statements: [
        {
          ...validQuestion.statements[0],
          text: "Light energy drives the synthesis of ATP and NADPH across thylakoid membranes, providing essential energy for carbohydrate production.",
        },
        validQuestion.statements[1],
        validQuestion.statements[2],
      ],
    };

    const result = validatePostGenerationChecks(verbatimQuestion, sourceText);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("verbatim similarity"))).toBe(true);
  });

  it("rejects near-duplicate statement pairs", () => {
    const duplicateQuestion: DevilsAdvocateQuestion = {
      ...validQuestion,
      statements: [
        validQuestion.statements[0],
        { ...validQuestion.statements[0], isTrue: false }, // Identical text
        validQuestion.statements[2],
      ],
    };

    const result = validatePostGenerationChecks(duplicateQuestion, sourceText);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("near-duplicates"))).toBe(true);
  });

  it("rejects rationale with zero vocabulary overlap with source text", () => {
    const ungroundedQuestion: DevilsAdvocateQuestion = {
      ...validQuestion,
      statements: [
        {
          ...validQuestion.statements[0],
          groundingRationale: "Xyz qwerty uiop zxcv bnm.",
        },
        validQuestion.statements[1],
        validQuestion.statements[2],
      ],
    };

    const result = validatePostGenerationChecks(ungroundedQuestion, sourceText);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("insufficient vocabulary overlap"))).toBe(true);
  });
});
