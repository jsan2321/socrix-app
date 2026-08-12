import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectEvidenceForQuestion } from "@/lib/rag/evidence";

const MOCK_CHUNK_ID = "550e8400-e29b-41d4-a716-446655440101";
const MOCK_DOC_ID = "550e8400-e29b-41d4-a716-446655440000";

// Mock Supabase admin client to return deterministic chunk records
vi.mock("@/lib/db/client", () => ({
  getSupabaseAdminClient: () => ({
    rpc: vi.fn().mockImplementation((fnName: string, args: { match_document_id?: string }) => {
      if (fnName === "match_document_chunks") {
        return Promise.resolve({
          data: [
            {
              chunk: {
                id: MOCK_CHUNK_ID,
                document_id: args.match_document_id || MOCK_DOC_ID,
                chunk_index: 0,
                page_start: 3,
                page_end: 3,
                paragraph_start: 2,
                paragraph_end: 3,
                sentence_start: 5,
                sentence_end: 8,
                heading: "3.2 Energy Cycle",
                text: "Adenosine triphosphate (ATP) serves as the primary energy currency of biological cells.",
                token_count: 120,
                created_at: new Date().toISOString(),
              },
              similarity: 0.88,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
    }),
  }),
}));

// Mock embedding generation to return a fixed 1536-dim vector
vi.mock("@/lib/ai/embeddings", () => ({
  generateSingleEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.05)),
}));

describe("Integration: Evidence Retrieval Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves evidence chunk with complete provenance coordinates and heading", async () => {
    const evidence = await selectEvidenceForQuestion({
      documentId: MOCK_DOC_ID,
      concept: "Cellular Energy",
      trueStatementText: "ATP serves as the primary energy currency of biological cells.",
      originChunkIds: [MOCK_CHUNK_ID],
    });

    expect(evidence).toBeDefined();
    expect(evidence.chunk_id).toBe(MOCK_CHUNK_ID);
    expect(evidence.page_start).toBe(3);
    expect(evidence.page_end).toBe(3);
    expect(evidence.paragraph_start).toBe(2);
    expect(evidence.paragraph_end).toBe(3);
    expect(evidence.sentence_start).toBe(5);
    expect(evidence.sentence_end).toBe(8);
    expect(evidence.heading).toBe("3.2 Energy Cycle");
    expect(evidence.text).toContain("Adenosine triphosphate");
    expect(evidence.similarity_score).toBeGreaterThanOrEqual(0.70);
    expect(evidence.is_origin_chunk).toBe(true);
  });
});
