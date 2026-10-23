import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateDevilsAdvocateQuiz } from "@/lib/quiz/generation";
import { ProviderError } from "@/lib/errors";
import { getGeneratedQuestionByRequestId, createQuizQuestionWithStatements } from "@/lib/db/quiz";

const { MOCK_SESSION_ID, MOCK_DOC_ID, MOCK_CHUNK_ID, MOCK_QUESTION_ID } = vi.hoisted(() => ({
  MOCK_SESSION_ID: "550e8400-e29b-41d4-a716-446655440000",
  MOCK_DOC_ID: "550e8400-e29b-41d4-a716-446655440001",
  MOCK_CHUNK_ID: "550e8400-e29b-41d4-a716-446655440002",
  MOCK_QUESTION_ID: "550e8400-e29b-41d4-a716-446655440003",
}));

const mockGenerateStructured = vi.fn();
const mockStreamText = vi.fn();
const streamingCapability = vi.hoisted(() => ({ enabled: true }));

vi.mock("@/lib/db/sessions", () => ({
  getSessionById: vi.fn().mockResolvedValue({
    id: MOCK_SESSION_ID,
    document_id: MOCK_DOC_ID,
    session_token: "550e8400-e29b-41d4-a716-446655440004",
    mode: "identify_truth",
    created_at: new Date().toISOString(),
  }),
  getSessionAnswers: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/chunks", () => {
  const mockChunks = [
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
  ];

  return {
    getChunksByDocumentId: vi.fn().mockResolvedValue(mockChunks),
    getChunksWithoutEmbeddingByDocumentId: vi.fn().mockResolvedValue(mockChunks),
  };
});

vi.mock("@/lib/db/quiz", () => ({
  getGeneratedQuestionByRequestId: vi.fn().mockResolvedValue(null),
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
        supportsStreaming: streamingCapability.enabled,
        jsonReliability: "high",
      },
    },
    generateStructured: mockGenerateStructured,
    streamText: mockStreamText,
  }),
}));

describe("Integration: Quiz Generation Pipeline", () => {
  const validQuizData = {
    concept: "Photosynthesis Overview",
    difficulty: "intermediate" as const,
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    streamingCapability.enabled = true;
    vi.mocked(getGeneratedQuestionByRequestId).mockResolvedValue(null);
  });

  it("uses structured JSON generation for providers without streaming support", async () => {
    streamingCapability.enabled = false;
    mockGenerateStructured.mockResolvedValue({ data: validQuizData, raw: {}, attempts: 1, provider: "openai", model: "gpt-4o-mini" });
    const result = await generateDevilsAdvocateQuiz({ sessionId: MOCK_SESSION_ID, onProgress: () => {} });
    expect(result.question.id).toBe(MOCK_QUESTION_ID);
    expect(mockStreamText).not.toHaveBeenCalled();
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
  });

  it("returns a previously persisted request without generating again", async () => {
    const requestId = "550e8400-e29b-41d4-a716-446655440199";
    vi.mocked(getGeneratedQuestionByRequestId).mockResolvedValueOnce({
      question: { id: MOCK_QUESTION_ID } as never,
      statements: [],
    });
    const result = await generateDevilsAdvocateQuiz({ sessionId: MOCK_SESSION_ID, requestId });
    expect(result.question.id).toBe(MOCK_QUESTION_ID);
    expect(mockGenerateStructured).not.toHaveBeenCalled();
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it("returns the same persisted question when a client repeats its request ID", async () => {
    const requestId = "550e8400-e29b-41d4-a716-446655440198";
    mockGenerateStructured.mockResolvedValue({ data: validQuizData, raw: {}, attempts: 1, provider: "openai", model: "gpt-4o-mini" });
    const first = await generateDevilsAdvocateQuiz({ sessionId: MOCK_SESSION_ID, requestId });
    vi.mocked(getGeneratedQuestionByRequestId).mockResolvedValueOnce({ question: first.question, statements: first.statements });
    const repeated = await generateDevilsAdvocateQuiz({ sessionId: MOCK_SESSION_ID, requestId });
    expect(repeated.question.id).toBe(first.question.id);
    expect(vi.mocked(createQuizQuestionWithStatements)).toHaveBeenCalledTimes(1);
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
  });

  it("validates streamed provider output before persistence", async () => {
    const statuses: string[] = [];
    mockStreamText.mockImplementation(async function* () { yield JSON.stringify(validQuizData); });
    await generateDevilsAdvocateQuiz({
      sessionId: MOCK_SESSION_ID,
      requestId: "550e8400-e29b-41d4-a716-446655440199",
      onProgress: (status) => statuses.push(status),
    });
    expect(statuses).toEqual(["selecting", "generating", "validating", "persisting"]);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createQuizQuestionWithStatements)).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: MOCK_SESSION_ID,
      requestId: "550e8400-e29b-41d4-a716-446655440199",
    }));
  });

  it("falls back to non-streaming generation after a provider stream failure", async () => {
    mockStreamText.mockImplementation(async function* () { throw new Error("Stream dropped"); });
    mockGenerateStructured.mockResolvedValue({ data: validQuizData, raw: {}, attempts: 1, provider: "openai", model: "gpt-4o-mini" });
    const result = await generateDevilsAdvocateQuiz({ sessionId: MOCK_SESSION_ID, onProgress: () => {} });
    expect(result.question.id).toBe(MOCK_QUESTION_ID);
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
  });

  it("orchestrates concept selection, prompt generation, post-checks, and DB persistence on first attempt", async () => {
    mockGenerateStructured.mockResolvedValueOnce({
      data: validQuizData,
      raw: {},
      attempts: 1,
      provider: "openai",
      model: "gpt-4o-mini",
    });

    const result = await generateDevilsAdvocateQuiz({
      sessionId: MOCK_SESSION_ID,
      excludeChunkIds: [],
    });

    expect(result).toBeDefined();
    expect(result.question.id).toBe(MOCK_QUESTION_ID);
    expect(result.question.concept).toBe("Photosynthesis Overview");
    expect(result.question.generation_attempts).toBe(1);
    expect(result.mode).toBe("identify_truth");
    expect(result.statements).toHaveLength(3);
    expect(result.statements.filter((s) => s.is_true)).toHaveLength(1);
  });

  it("recovers via repair-retry loop when attempt 1 fails validation", async () => {
    // Attempt 1: Fails post-checks (2 true statements)
    const invalidTwoTrueData = {
      ...validQuizData,
      statements: [
        { ...validQuizData.statements[0], isTrue: true },
        { ...validQuizData.statements[1], isTrue: true },
        { ...validQuizData.statements[2], isTrue: false },
      ],
    };

    mockGenerateStructured
      .mockResolvedValueOnce({
        data: invalidTwoTrueData,
        raw: {},
        attempts: 1,
        provider: "openai",
        model: "gpt-4o-mini",
      })
      .mockResolvedValueOnce({
        data: validQuizData,
        raw: {},
        attempts: 1,
        provider: "openai",
        model: "gpt-4o-mini",
      });

    const result = await generateDevilsAdvocateQuiz({
      sessionId: MOCK_SESSION_ID,
      excludeChunkIds: [],
    });

    expect(result).toBeDefined();
    expect(result.question.generation_attempts).toBe(2);
    expect(mockGenerateStructured).toHaveBeenCalledTimes(2);
  });

  it("throws ProviderError when repair retries are completely exhausted", async () => {
    // Both attempts fail
    mockGenerateStructured.mockRejectedValue(new Error("AI Gateway Timeout 504"));

    await expect(
      generateDevilsAdvocateQuiz({
        sessionId: MOCK_SESSION_ID,
        excludeChunkIds: [],
      })
    ).rejects.toThrow(ProviderError);

    expect(mockGenerateStructured).toHaveBeenCalledTimes(2);
  });
});
