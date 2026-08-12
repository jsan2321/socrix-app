import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateEmbeddings,
  EMBEDDING_DIMENSION,
} from "@/lib/ai/embeddings";
import { ProviderError } from "@/lib/errors";

// Helper to generate a fake vector of dimension D
function makeVector(dim = EMBEDDING_DIMENSION): number[] {
  return new Array(dim).fill(0.1);
}

const mockCreateEmbeddings = vi.fn();

vi.mock("@/lib/config", () => ({
  config: {
    OPENAI_API_KEY: "test-openai-key",
    EMBEDDING_MODEL: "text-embedding-3-small",
  },
}));

// Mock OpenAI SDK
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: mockCreateEmbeddings,
      };
    },
  };
});

describe("Embeddings Client Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when given empty input array", async () => {
    const result = await generateEmbeddings([]);
    expect(result).toEqual([]);
  });

  it("generates 1536-dimensional embeddings for valid batch", async () => {
    mockCreateEmbeddings.mockResolvedValueOnce({
      data: [
        { index: 0, embedding: makeVector(1536) },
        { index: 1, embedding: makeVector(1536) },
      ],
    });

    const texts = ["Hello world", "Socratic testing"];
    const results = await generateEmbeddings(texts, "test-key");

    expect(results).toHaveLength(2);
    expect(results[0]).toHaveLength(1536);
    expect(results[1]).toHaveLength(1536);
  });

  it("throws ProviderError if returned vector length !== 1536", async () => {
    mockCreateEmbeddings.mockResolvedValueOnce({
      data: [{ index: 0, embedding: makeVector(512) }], // Wrong dimension!
    });

    await expect(generateEmbeddings(["Invalid vector test"], "test-key")).rejects.toThrow(
      ProviderError
    );
  });

  it("batches large requests into chunks of <= 96 items", async () => {
    mockCreateEmbeddings.mockImplementation((opts: { input: string[] }) => {
      const count = opts.input.length;
      return Promise.resolve({
        data: Array.from({ length: count }, (_, i) => ({
          index: i,
          embedding: makeVector(1536),
        })),
      });
    });

    const largeInput = Array.from({ length: 100 }, (_, i) => `Sentence ${i}`);
    const results = await generateEmbeddings(largeInput, "test-key");

    expect(results).toHaveLength(100);
    expect(mockCreateEmbeddings).toHaveBeenCalledTimes(2);
  });
});
