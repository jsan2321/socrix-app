import { describe, it, expect } from "vitest";
import { DevilsAdvocateSchema } from "@/schemas/quiz";

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
        { ...validPayload.statements[0], isTrue: false }, // Duplicate text
        { ...validPayload.statements[2] },
      ],
    };
    const parseResult = DevilsAdvocateSchema.safeParse(payload);
    expect(parseResult.success).toBe(false);
    if (!parseResult.success) {
      expect(parseResult.error.issues[0].message).toContain("Statements must be distinct");
    }
  });
});
