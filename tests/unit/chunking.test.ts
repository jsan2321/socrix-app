import { describe, it, expect } from "vitest";
import { chunkParsedDocument } from "@/lib/rag/chunking";
import { ParsedDocument } from "@/lib/pdf/structure-extraction";

describe("Semantic Chunking Engine", () => {
  it("should generate semantic chunks with coordinate tracking and token bounds", () => {
    const sampleSentences = Array.from(
      { length: 40 },
      (_, i) =>
        `Sentence number ${i + 1} provides detailed academic domain context for retrieval practice testing.`
    );

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
              sentences: sampleSentences
                .slice(0, 20)
                .map((text, idx) => ({ sentenceIndex: idx + 1, text })),
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
              sentences: sampleSentences
                .slice(20)
                .map((text, idx) => ({ sentenceIndex: idx + 1, text })),
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

  it("should return an empty array when document contains no extractable sentences", () => {
    const emptyDoc: ParsedDocument = {
      pageCount: 1,
      totalCharacters: 0,
      pages: [
        {
          pageNumber: 1,
          text: "",
          paragraphs: [],
        },
      ],
    };

    const chunks = chunkParsedDocument(emptyDoc, "doc-empty");
    expect(chunks).toEqual([]);
  });

  it("should gracefully handle empty paragraphs without producing invalid chunks", () => {
    const docWithEmptyParagraphs: ParsedDocument = {
      pageCount: 1,
      totalCharacters: 150,
      pages: [
        {
          pageNumber: 1,
          text: "Some valid sentence here.",
          paragraphs: [
            {
              paragraphIndex: 1,
              text: "",
              headingContext: null,
              sentences: [],
            },
            {
              paragraphIndex: 2,
              text: "A valid academic sentence that contains sufficient information for active retrieval.",
              headingContext: "Valid Section",
              sentences: [
                {
                  sentenceIndex: 1,
                  text: "A valid academic sentence that contains sufficient information for active retrieval.",
                },
              ],
            },
            {
              paragraphIndex: 3,
              text: "   ",
              headingContext: null,
              sentences: [],
            },
          ],
        },
      ],
    };

    const chunks = chunkParsedDocument(docWithEmptyParagraphs, "doc-with-empty-paras");
    expect(chunks.length).toBe(1);
    expect(chunks[0].heading).toBe("Valid Section");
    expect(chunks[0].paragraphStart).toBe(2);
  });

  it("should preserve coordinates and heading for single-sentence documents", () => {
    const singleSentenceDoc: ParsedDocument = {
      pageCount: 1,
      totalCharacters: 60,
      pages: [
        {
          pageNumber: 1,
          text: "Single isolated sentence providing foundational domain facts.",
          paragraphs: [
            {
              paragraphIndex: 1,
              text: "Single isolated sentence providing foundational domain facts.",
              headingContext: "Overview",
              sentences: [
                {
                  sentenceIndex: 1,
                  text: "Single isolated sentence providing foundational domain facts.",
                },
              ],
            },
          ],
        },
      ],
    };

    const chunks = chunkParsedDocument(singleSentenceDoc, "doc-single");
    expect(chunks.length).toBe(1);
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[0].pageEnd).toBe(1);
    expect(chunks[0].paragraphStart).toBe(1);
    expect(chunks[0].sentenceStart).toBe(1);
    expect(chunks[0].sentenceEnd).toBe(1);
    expect(chunks[0].heading).toBe("Overview");
  });

  it("should maintain sequential chunkIndex across all generated chunks", () => {
    const sentences = Array.from(
      { length: 60 },
      (_, i) => `Sentence ${i + 1} adds substantive scientific domain context for chunk boundary verification.`
    );

    const multiChunkDoc: ParsedDocument = {
      pageCount: 3,
      totalCharacters: sentences.join(" ").length,
      pages: [1, 2, 3].map((pageNum) => ({
        pageNumber: pageNum,
        text: sentences.slice((pageNum - 1) * 20, pageNum * 20).join(" "),
        paragraphs: [
          {
            paragraphIndex: 1,
            text: sentences.slice((pageNum - 1) * 20, pageNum * 20).join(" "),
            headingContext: `Section ${pageNum}`,
            sentences: sentences
              .slice((pageNum - 1) * 20, pageNum * 20)
              .map((text, idx) => ({ sentenceIndex: idx + 1, text })),
          },
        ],
      })),
    };

    const chunks = chunkParsedDocument(multiChunkDoc, "doc-multi");
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx);
    });
  });
});
