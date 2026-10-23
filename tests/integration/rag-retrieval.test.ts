import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectEvidenceForQuestion } from "@/lib/rag/evidence";
import * as retrievalService from "@/lib/rag/retrieval";
import * as chunksDb from "@/lib/db/chunks";
import { InsufficientEvidenceError, NotFoundError } from "@/lib/errors";

const MOCK_DOC_ID = "550e8400-e29b-41d4-a716-446655440020";
const ORIGIN_CHUNK_ID = "550e8400-e29b-41d4-a716-446655440021";
const OTHER_CHUNK_ID = "550e8400-e29b-41d4-a716-446655440022";

vi.mock("@/lib/rag/retrieval");
vi.mock("@/lib/db/chunks");

describe("Integration: RAG Evidence Retrieval with Seeded Vectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects top-ranked chunk when similarity exceeds 0.70 threshold", async () => {
    vi.spyOn(retrievalService, "retrieveSimilarChunks").mockResolvedValueOnce([
      {
        chunk: {
          id: OTHER_CHUNK_ID,
          document_id: MOCK_DOC_ID,
          chunk_index: 1,
          page_start: 2,
          page_end: 2,
          paragraph_start: 1,
          paragraph_end: 2,
          sentence_start: 1,
          sentence_end: 3,
          heading: "Cellular Energy",
          text: "ATP powers vital biological processes in eukaryotes.",
          token_count: 120,
          created_at: new Date().toISOString(),
        },
        similarity: 0.88,
      },
    ]);

    const result = await selectEvidenceForQuestion({
      documentId: MOCK_DOC_ID,
      concept: "Cellular Energy",
      trueStatementText: "ATP powers vital biological processes in eukaryotes.",
      originChunkIds: [ORIGIN_CHUNK_ID],
    });

    expect(result.chunk_id).toBe(OTHER_CHUNK_ID);
    expect(result.similarity_score).toBe(0.88);
    expect(result.is_origin_chunk).toBe(false);
  });

  it("applies origin-chunk preference boost when origin chunk is within 0.05 similarity window", async () => {
    vi.spyOn(retrievalService, "retrieveSimilarChunks").mockResolvedValueOnce([
      {
        chunk: {
          id: OTHER_CHUNK_ID,
          document_id: MOCK_DOC_ID,
          chunk_index: 1,
          page_start: 2,
          page_end: 2,
          paragraph_start: 1,
          paragraph_end: 2,
          sentence_start: 1,
          sentence_end: 3,
          heading: "General Respiration",
          text: "General respiration notes.",
          token_count: 110,
          created_at: new Date().toISOString(),
        },
        similarity: 0.84, // Higher raw similarity
      },
      {
        chunk: {
          id: ORIGIN_CHUNK_ID, // Origin chunk with 0.81 (within 0.05 window: 0.84 - 0.05 = 0.79)
          document_id: MOCK_DOC_ID,
          chunk_index: 0,
          page_start: 1,
          page_end: 1,
          paragraph_start: 1,
          paragraph_end: 1,
          sentence_start: 1,
          sentence_end: 2,
          heading: "Cellular Energy",
          text: "Origin chunk text on cellular energy.",
          token_count: 130,
          created_at: new Date().toISOString(),
        },
        similarity: 0.81,
      },
    ]);

    const result = await selectEvidenceForQuestion({
      documentId: MOCK_DOC_ID,
      concept: "Cellular Energy",
      trueStatementText: "Origin chunk text on cellular energy.",
      originChunkIds: [ORIGIN_CHUNK_ID],
    });

    expect(result.chunk_id).toBe(ORIGIN_CHUNK_ID);
    expect(result.is_origin_chunk).toBe(true);
  });

  it("falls back to origin chunk when retrieval finds no chunks meeting the 0.70 threshold", async () => {
    vi.spyOn(retrievalService, "retrieveSimilarChunks").mockResolvedValueOnce([]);

    vi.spyOn(chunksDb, "getChunkById").mockResolvedValueOnce({
      id: ORIGIN_CHUNK_ID,
      document_id: MOCK_DOC_ID,
      chunk_index: 0,
      page_start: 1,
      page_end: 1,
      paragraph_start: 1,
      paragraph_end: 1,
      sentence_start: 1,
      sentence_end: 2,
      heading: "Origin Section",
      text: "Text from the designated origin grounding chunk.",
      token_count: 150,
      created_at: new Date().toISOString(),
    });

    const result = await selectEvidenceForQuestion({
      documentId: MOCK_DOC_ID,
      concept: "Cellular Energy",
      trueStatementText: "Statement requiring grounding.",
      originChunkIds: [ORIGIN_CHUNK_ID],
    });

    expect(result.chunk_id).toBe(ORIGIN_CHUNK_ID);
    expect(result.is_origin_chunk).toBe(true);
    expect(result.similarity_score).toBe(0.70); // Fallback nominal score
  });

  it("throws InsufficientEvidenceError when both retrieval and origin chunk fallback are unavailable", async () => {
    vi.spyOn(retrievalService, "retrieveSimilarChunks").mockResolvedValueOnce([]);
    vi.spyOn(chunksDb, "getChunkById").mockRejectedValueOnce(new NotFoundError("Chunk not found"));

    await expect(
      selectEvidenceForQuestion({
        documentId: MOCK_DOC_ID,
        concept: "Cellular Energy",
        trueStatementText: "No grounding exists.",
        originChunkIds: ["non-existent-chunk"],
      })
    ).rejects.toThrow(InsufficientEvidenceError);
  });
});
