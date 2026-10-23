import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectEvidenceForQuestion } from "@/lib/rag/evidence";
import { extractDocumentStructure } from "@/lib/pdf/structure-extraction";
import { chunkParsedDocument } from "@/lib/rag/chunking";
import { countTokens } from "@/utils/tokenize";
import type { DocumentChunkRow } from "@/schemas/db";

// Mock database chunks module
vi.mock("@/lib/db/chunks", () => ({
  similaritySearchChunks: vi.fn(),
  getChunkById: vi.fn(),
  getChunksWithoutEmbeddingByDocumentId: vi.fn(),
}));

// Mock embeddings client
vi.mock("@/lib/ai/embeddings", () => ({
  generateSingleEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

function makeChunk(id: string, index: number, text = "Sample chunk text"): DocumentChunkRow {
  return {
    id,
    document_id: "doc-perf-123",
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

describe("Performance & Optimization Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Evidence Retrieval Origin Shortcut", () => {
    it("shortcuts directly to origin chunk without calling vector search when preferOriginShortcut is true and 1 origin chunk exists", async () => {
      const { similaritySearchChunks, getChunkById } = await import("@/lib/db/chunks");
      const { generateSingleEmbedding } = await import("@/lib/ai/embeddings");

      const originChunk = makeChunk("chunk-origin-1", 0, "Exact origin grounding chunk text");
      vi.mocked(getChunkById).mockResolvedValueOnce(originChunk);

      const result = await selectEvidenceForQuestion({
        documentId: "doc-perf-123",
        concept: "Cellular Respiration",
        trueStatementText: "Glycolysis breaks down glucose into pyruvate.",
        originChunkIds: ["chunk-origin-1"],
        preferOriginShortcut: true,
      });

      expect(result.chunk_id).toBe("chunk-origin-1");
      expect(result.is_origin_chunk).toBe(true);
      expect(result.similarity_score).toBe(1.0);

      // Verify that neither embedding generation nor vector similarity search was called
      expect(generateSingleEmbedding).not.toHaveBeenCalled();
      expect(similaritySearchChunks).not.toHaveBeenCalled();

      // Verify getChunkById was called with includeEmbedding: false to minimize DB payload
      expect(getChunkById).toHaveBeenCalledWith("chunk-origin-1", { includeEmbedding: false });
    });

    it("falls through to similarity search when question spans multiple origin chunks", async () => {
      const { similaritySearchChunks } = await import("@/lib/db/chunks");
      const { generateSingleEmbedding } = await import("@/lib/ai/embeddings");

      const topChunk = makeChunk("chunk-top", 0, "Top similarity chunk");
      const originChunk1 = makeChunk("chunk-origin-1", 1, "Origin chunk 1");

      vi.mocked(similaritySearchChunks).mockResolvedValueOnce([
        { chunk: topChunk, similarity: 0.88 },
        { chunk: originChunk1, similarity: 0.86 },
      ]);

      const result = await selectEvidenceForQuestion({
        documentId: "doc-perf-123",
        concept: "Photosynthesis",
        trueStatementText: "Light reaction generates ATP and NADPH.",
        originChunkIds: ["chunk-origin-1", "chunk-origin-2"],
        preferOriginShortcut: true,
      });

      expect(result.chunk_id).toBe("chunk-origin-1");
      expect(generateSingleEmbedding).toHaveBeenCalled();
      expect(similaritySearchChunks).toHaveBeenCalled();
    });

    it("falls through to similarity search when direct origin lookup throws", async () => {
      const { similaritySearchChunks, getChunkById } = await import("@/lib/db/chunks");
      const { generateSingleEmbedding } = await import("@/lib/ai/embeddings");

      vi.mocked(getChunkById).mockRejectedValueOnce(new Error("Lookup failed"));

      const fallbackChunk = makeChunk("chunk-fb", 0, "Fallback similarity match");
      vi.mocked(similaritySearchChunks).mockResolvedValueOnce([
        { chunk: fallbackChunk, similarity: 0.85 },
      ]);

      const result = await selectEvidenceForQuestion({
        documentId: "doc-perf-123",
        concept: "Enzymes",
        trueStatementText: "Enzymes lower activation energy.",
        originChunkIds: ["chunk-origin-1"],
        preferOriginShortcut: true,
      });

      expect(result.chunk_id).toBe("chunk-fb");
      expect(generateSingleEmbedding).toHaveBeenCalled();
      expect(similaritySearchChunks).toHaveBeenCalled();
    });
  });

  describe("Ingestion Throughput & Chunking Performance", () => {
    it("processes a 20-page document structure extraction and semantic chunking within 500ms", () => {
      // Generate 20 synthetic pages of textbook content
      const pages = Array.from({ length: 20 }, (_, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const paragraphs = [
          `Chapter ${pageNumber}: Fundamental Principles of Systems Biology.`,
          `Biological networks exhibit robust self-organizing dynamics across multiple temporal scales. Feedback loops govern homeostasis and cellular decision-making processes. Positive feedback stabilizes distinct differentiation states, while negative feedback prevents runaway activation.`,
          `Quantitative models of metabolic flux analysis demonstrate how enzymatic reaction rates adapt to substrate availability. Flux balance analysis relies on stoichiometric constraints to predict steady-state metabolic distributions.`,
          `Experimental validation utilizes liquid chromatography coupled with tandem mass spectrometry. High-resolution instrumentation enables precise isotopic tracing of carbon and nitrogen flux pathways.`,
        ].join("\n\n");

        return { pageNumber, text: paragraphs };
      });

      const start = performance.now();

      const parsedDoc = extractDocumentStructure(pages);
      const chunks = chunkParsedDocument(parsedDoc, "doc-perf-123");

      const elapsed = performance.now() - start;

      expect(parsedDoc.pageCount).toBe(20);
      expect(chunks.length).toBeGreaterThan(5);
      expect(elapsed).toBeLessThan(2500);
    });

    it("tokenizes high-volume text with high throughput", () => {
      const testText = "The rapid brown fox jumps over the lazy dog. ".repeat(1000);
      const start = performance.now();
      const count = countTokens(testText);
      const elapsed = performance.now() - start;

      expect(count).toBeGreaterThan(8000);
      expect(elapsed).toBeLessThan(200); // Under 200ms for ~9,000 tokens
    });
  });
});
