import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  selectEvidenceForQuestion,
  constructEvidenceQuery,
} from "@/lib/rag/evidence";
import { InsufficientEvidenceError } from "@/lib/errors";
import type { DocumentChunkRow } from "@/schemas/db";

// Mock DB chunks accessor
vi.mock("@/lib/db/chunks", () => ({
  similaritySearchChunks: vi.fn(),
  getChunkById: vi.fn(),
}));

// Mock embeddings client
vi.mock("@/lib/ai/embeddings", () => ({
  generateSingleEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

function makeChunk(id: string, index: number, text = "Sample chunk text"): DocumentChunkRow {
  return {
    id,
    document_id: "doc-123",
    chunk_index: index,
    page_start: 1,
    page_end: 1,
    paragraph_start: 1,
    paragraph_end: 2,
    sentence_start: 1,
    sentence_end: 4,
    heading: "Section 1",
    text,
    token_count: 150,
    created_at: new Date().toISOString(),
  };
}

describe("RAG Evidence Retrieval & Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs evidence query correctly from concept and true statement text", () => {
    const query = constructEvidenceQuery("Photosynthesis", "Light energy splits water molecules.");
    expect(query).toBe("Photosynthesis: Light energy splits water molecules.");
  });

  it("applies origin-chunk preference boost when origin chunk similarity is within 0.05 of top match", async () => {
    const { similaritySearchChunks } = await import("@/lib/db/chunks");

    const topChunk = makeChunk("chunk-top", 0, "Top similarity chunk text");
    const originChunk = makeChunk("chunk-origin", 1, "Origin grounding chunk text");

    // topChunk similarity = 0.85, originChunk similarity = 0.82 (diff 0.03 <= 0.05)
    vi.mocked(similaritySearchChunks).mockResolvedValueOnce([
      { chunk: topChunk, similarity: 0.85 },
      { chunk: originChunk, similarity: 0.82 },
    ]);

    const result = await selectEvidenceForQuestion({
      documentId: "doc-123",
      concept: "Photosynthesis",
      trueStatementText: "Light energy splits water molecules.",
      originChunkIds: ["chunk-origin"],
    });

    expect(result.chunk_id).toBe("chunk-origin");
    expect(result.is_origin_chunk).toBe(true);
    expect(result.similarity_score).toBe(0.82);
  });

  it("selects top similarity match when origin chunk similarity is outside 0.05 window", async () => {
    const { similaritySearchChunks } = await import("@/lib/db/chunks");

    const topChunk = makeChunk("chunk-top", 0, "Top similarity chunk text");
    const originChunk = makeChunk("chunk-origin", 1, "Origin grounding chunk text");

    // topChunk similarity = 0.90, originChunk similarity = 0.80 (diff 0.10 > 0.05)
    vi.mocked(similaritySearchChunks).mockResolvedValueOnce([
      { chunk: topChunk, similarity: 0.90 },
      { chunk: originChunk, similarity: 0.80 },
    ]);

    const result = await selectEvidenceForQuestion({
      documentId: "doc-123",
      concept: "Photosynthesis",
      trueStatementText: "Light energy splits water molecules.",
      originChunkIds: ["chunk-origin"],
    });

    expect(result.chunk_id).toBe("chunk-top");
    expect(result.is_origin_chunk).toBe(false);
    expect(result.similarity_score).toBe(0.9);
  });

  it("falls back to origin chunk lookup when no similarity match meets 0.70 threshold", async () => {
    const { similaritySearchChunks, getChunkById } = await import("@/lib/db/chunks");

    // No similarity matches >= 0.70 returned
    vi.mocked(similaritySearchChunks).mockResolvedValueOnce([]);

    const originChunk = makeChunk("chunk-origin", 1, "Origin grounding chunk text");
    vi.mocked(getChunkById).mockResolvedValueOnce(originChunk);

    const result = await selectEvidenceForQuestion({
      documentId: "doc-123",
      concept: "Photosynthesis",
      trueStatementText: "Light energy splits water molecules.",
      originChunkIds: ["chunk-origin"],
    });

    expect(result.chunk_id).toBe("chunk-origin");
    expect(result.is_origin_chunk).toBe(true);
    expect(result.similarity_score).toBe(0.7);
  });

  it("throws InsufficientEvidenceError when no match >= 0.70 and origin chunk unavailable", async () => {
    const { similaritySearchChunks, getChunkById } = await import("@/lib/db/chunks");

    vi.mocked(similaritySearchChunks).mockResolvedValueOnce([]);
    vi.mocked(getChunkById).mockRejectedValueOnce(new Error("Chunk not found"));

    await expect(
      selectEvidenceForQuestion({
        documentId: "doc-123",
        concept: "Photosynthesis",
        trueStatementText: "Light energy splits water molecules.",
        originChunkIds: ["chunk-missing"],
      })
    ).rejects.toThrow(InsufficientEvidenceError);
  });
});
