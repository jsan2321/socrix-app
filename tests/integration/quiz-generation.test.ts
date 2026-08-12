import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateDevilsAdvocateQuiz } from "@/lib/quiz/generation";

const { MOCK_SESSION_ID, MOCK_DOC_ID, MOCK_CHUNK_ID, MOCK_QUESTION_ID } = vi.hoisted(() => ({
  MOCK_SESSION_ID: "550e8400-e29b-41d4-a716-446655440000",
  MOCK_DOC_ID: "550e8400-e29b-41d4-a716-446655440001",
  MOCK_CHUNK_ID: "550e8400-e29b-41d4-a716-446655440002",
  MOCK_QUESTION_ID: "550e8400-e29b-41d4-a716-446655440003",
}));

vi.mock("@/lib/db/sessions", () => ({
  getSessionById: vi.fn().mockResolvedValue({
    id: MOCK_SESSION_ID,
    document_id: MOCK_DOC_ID,
    session_token: "550e8400-e29b-41d4-a716-446655440004",
    mode: "identify_truth",
    created_at: new Date().toISOString(),
  }),
}));

vi.mock("@/lib/db/chunks", () => ({
  getChunksByDocumentId: vi.fn().mockResolvedValue([
    {
      id: MOCK_CHUNK_ID,
      document_id: MOCK_DOC_ID,
      chunk_index: 0,
      page_start: 1,
      page_end: 1,
      paragraph_start: 1,
      paragraph_end: 2,
      sentence_start: 1,
      sentence_end: 4,
      heading: "Photosynthesis Overview",
      text: "Photosynthesis converts light energy into chemical energy stored in glucose molecules inside plant chloroplasts.",
      token_count: 180,
      created_at: new Date().toISOString(),
    },
  ]),
}));

vi.mock("@/lib/db/quiz", () => ({
  createQuizQuestionWithStatements: vi.fn().mockImplementation((input: {
    documentId: string;
    concept: string;
    difficulty: string;
    groundingChunkIds: string[];
    generationProvider: string;
    generationModel: string;
    generationAttempts: number;
    statements: Array<{ text: string; isTrue: boolean; groundingRationale: string; displayOrder?: number }>;
  }) => {
    return Promise.resolve({
      question: {
        id: MOCK_QUESTION_ID,
        document_id: input.documentId,
        concept: input.concept,
        difficulty: input.difficulty,
        grounding_chunk_ids: input.groundingChunkIds,
        generation_provider: input.generationProvider,
        generation_model: input.generationModel,
        generation_attempts: input.generationAttempts,
        created_at: new Date().toISOString(),
      },
      statements: input.statements.map((s, idx: number) => ({
        id: `550e8400-e29b-41d4-a716-44665544001${idx}`,
        question_id: MOCK_QUESTION_ID,
        text: s.text,
        is_true: s.isTrue,
        grounding_rationale: s.groundingRationale,
        display_order: s.displayOrder ?? idx + 1,
      })),
    });
  }),
}));

vi.mock("@/lib/ai/get-provider", () => ({
  getProvider: () => ({
    name: "openai",
    config: {
      provider: "openai",
      model: "gpt-4o-mini",
      capabilities: {
        supportsNativeStructuredOutput: true,
        jsonReliability: "high",
      },
    },
    generateStructured: vi.fn().mockResolvedValue({
      data: {
        concept: "Photosynthesis Overview",
        difficulty: "intermediate",
        statements: [
          {
            text: "Solar light energy transforms into chemical bond energy stored in sugar molecules within plant chloroplasts.",
            isTrue: true,
            groundingRationale: "Text states photosynthesis converts light energy into chemical energy stored in glucose inside chloroplasts.",
          },
          {
            text: "Plant chloroplasts consume glucose to generate sunlight energy during night cycles.",
            isTrue: false,
            groundingRationale: "Reverses true flow; light energy is converted to chemical energy, not consumed to make sunlight.",
          },
          {
            text: "Photosynthesis occurs exclusively within animal cell mitochondria without requiring light.",
            isTrue: false,
            groundingRationale: "Falsely attributes photosynthesis to animal mitochondria instead of plant chloroplasts.",
          },
        ],
      },
      raw: {},
      attempts: 1,
      provider: "openai",
      model: "gpt-4o-mini",
    }),
  }),
}));

describe("Integration: Quiz Generation Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orchestrates concept selection, prompt generation, post-checks, and DB persistence", async () => {
    const result = await generateDevilsAdvocateQuiz({
      sessionId: MOCK_SESSION_ID,
      excludeChunkIds: [],
    });

    expect(result).toBeDefined();
    expect(result.question.id).toBe(MOCK_QUESTION_ID);
    expect(result.question.concept).toBe("Photosynthesis Overview");
    expect(result.statements).toHaveLength(3);
    expect(result.statements.filter((s) => s.is_true)).toHaveLength(1);
  });
});
