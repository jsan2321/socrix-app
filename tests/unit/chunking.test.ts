import { describe, it, expect } from "vitest";
import { chunkParsedDocument } from "@/lib/rag/chunking";
import { ParsedDocument } from "@/lib/pdf/structure-extraction";

describe("Semantic Chunking Engine", () => {
  it("should generate semantic chunks with coordinate tracking and token bounds", () => {
    // Construct a synthetic ParsedDocument with multiple sentences
    const sampleSentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i + 1} provides detailed academic domain context for retrieval practice testing.`);
    
    const mockParsedDoc: ParsedDocument = {
      pageCount: 2,
      totalCharacters: sampleSentences.join(" ").length,
      pages: [
        {
          pageNumber: 1,
          text: sampleSentences.slice(0, 20).join(" "),
          paragraphs: [
            {
              paragraphIndex: 1,
              text: sampleSentences.slice(0, 20).join(" "),
              headingContext: "1.1 Introduction to Learning",
              sentences: sampleSentences.slice(0, 20).map((text, idx) => ({ sentenceIndex: idx + 1, text })),
            },
          ],
        },
        {
          pageNumber: 2,
          text: sampleSentences.slice(20).join(" "),
          paragraphs: [
            {
              paragraphIndex: 2,
              text: sampleSentences.slice(20).join(" "),
              headingContext: "1.2 Socratic Methods",
              sentences: sampleSentences.slice(20).map((text, idx) => ({ sentenceIndex: idx + 1, text })),
            },
          ],
        },
      ],
    };

    const docId = "123e4567-e89b-12d3-a456-426614174000";
    const chunks = chunkParsedDocument(mockParsedDoc, docId);

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.documentId).toBe(docId);
      expect(chunk.tokenCount).toBeGreaterThanOrEqual(100);
      expect(chunk.tokenCount).toBeLessThanOrEqual(600);
      expect(chunk.pageStart).toBeGreaterThanOrEqual(1);
      expect(chunk.pageEnd).toBeGreaterThanOrEqual(chunk.pageStart);
      expect(chunk.heading).not.toBeNull();
    }
  });

  it("should handle forced splits for sentences exceeding token limit", () => {
    const hugeSentence = "Word ".repeat(700); // Exceeds 600 token ceiling
    const mockParsedDoc: ParsedDocument = {
      pageCount: 1,
      totalCharacters: hugeSentence.length,
      pages: [
        {
          pageNumber: 1,
          text: hugeSentence,
          paragraphs: [
            {
              paragraphIndex: 1,
              text: hugeSentence,
              headingContext: "Anomalous Chapter",
              sentences: [{ sentenceIndex: 1, text: hugeSentence }],
            },
          ],
        },
      ],
    };

    const chunks = chunkParsedDocument(mockParsedDoc, "doc-123");

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].truncatedSplit).toBe(true);
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(600);
  });
});
