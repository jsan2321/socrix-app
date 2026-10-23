import { describe, it, expect } from "vitest";
import { DevilsAdvocateSchema, QuizStatementSchema } from "@/schemas/quiz";

describe("DevilsAdvocateSchema Zod Invariants", () => {
  const validPayload = {
    concept: "Photosynthesis Light Reactions",
    difficulty: "intermediate",
    statements: [
      {
        text: "Photon absorption excites electrons in photosystem II to a higher energy state.",
        isTrue: true,
        groundingRationale: "Supported by page 4 paragraph 2 regarding photosystem electron excitation.",
      },
      {
        text: "Photons break down glucose directly into water and carbon dioxide during light reactions.",
        isTrue: false,
        groundingRationale: "Distorts the role of light reactions which generate ATP/NADPH, not glucose breakdown.",
      },
      {
        text: "Light reactions occur inside the cell nucleus without requiring thylakoid membranes.",
        isTrue: false,
        groundingRationale: "Falsely claims nucleus location when reactions occur in chloroplast thylakoid membranes.",
      },
    ],
  };

  it("accepts valid question structure with exactly 1 true statement", () => {
    const parseResult = DevilsAdvocateSchema.safeParse(validPayload);
    expect(parseResult.success).toBe(true);
  });

  it("rejects payload with 0 true statements", () => {
    const payload = {
      ...validPayload,
      statements: validPayload.statements.map((s) => ({ ...s, isTrue: false })),
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues[0].message).toContain("Expected exactly 1 true statement");
    }
  });

  it("rejects payload with 2 true statements", () => {
    const payload = {
      ...validPayload,
      statements: [
        { ...validPayload.statements[0], isTrue: true },
        { ...validPayload.statements[1], isTrue: true },
        { ...validPayload.statements[2], isTrue: false },
      ],
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues[0].message).toContain("Expected exactly 1 true statement");
    }
  });

  it("rejects payload with duplicate statement texts", () => {
    const payload = {
      ...validPayload,
      statements: [
        { ...validPayload.statements[0] },
        { ...validPayload.statements[0], isTrue: false },
        { ...validPayload.statements[2] },
      ],
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues[0].message).toContain("Statements must be distinct");
    }
  });

  it("rejects payload with only 2 statements (length < 3)", () => {
    const payload = {
      ...validPayload,
      statements: validPayload.statements.slice(0, 2),
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues.some((i) => i.message.includes("Must contain exactly 3 statements"))).toBe(true);
    }
  });

  it("rejects payload with 4 statements (length > 3)", () => {
    const payload = {
      ...validPayload,
      statements: [
        ...validPayload.statements,
        {
          text: "An additional extraneous statement that exceeds the strict length invariant.",
          isTrue: false,
          groundingRationale: "Fourth statement causing validation error.",
        },
      ],
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues.some((i) => i.message.includes("Must contain exactly 3 statements"))).toBe(true);
    }
  });

  it("rejects invalid difficulty enum values", () => {
    const payload = {
      ...validPayload,
      difficulty: "expert",
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
  });

  it("rejects concept title that is too short (< 3 characters)", () => {
    const payload = {
      ...validPayload,
      concept: "AB",
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
  });

  it("rejects statement text shorter than 20 characters", () => {
    const invalidStatement = {
      text: "Too short.",
      isTrue: true,
      groundingRationale: "Valid rationale for short statement.",
    };
    const parseResult = QuizStatementSchema.safeParse(invalidStatement);
    expect(parseResult.success).toBe(false);
  });

  it("rejects groundingRationale shorter than 10 characters", () => {
    const invalidStatement = {
      text: "This is a statement of sufficient length to pass the text length check.",
      isTrue: true,
      groundingRationale: "Short",
    };
    const parseResult = QuizStatementSchema.safeParse(invalidStatement);
    expect(parseResult.success).toBe(false);
  });
});
