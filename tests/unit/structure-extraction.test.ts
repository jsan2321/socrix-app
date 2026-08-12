import { describe, it, expect } from "vitest";
import {
  segmentSentences,
  isLikelyHeading,
  extractDocumentStructure,
} from "@/lib/pdf/structure-extraction";

describe("Document Structure Extraction", () => {
  it("should segment sentences accurately without breaking abbreviations", () => {
    const text = "Dr. Smith presented e.g. three examples. The results were conclusive! Is retrieval effective?";
    const sentences = segmentSentences(text);

    expect(sentences.length).toBe(3);
    expect(sentences[0]).toContain("Dr. Smith presented e.g. three examples.");
    expect(sentences[1]).toBe("The results were conclusive!");
    expect(sentences[2]).toBe("Is retrieval effective?");
  });

  it("should identify likely section headings", () => {
    expect(isLikelyHeading("Chapter 1 Introduction")).toBe(true);
    expect(isLikelyHeading("2.1 Semantic Chunking Rules")).toBe(true);
    expect(isLikelyHeading("Executive Summary")).toBe(true);
    expect(isLikelyHeading("This is a full sentence of prose text that ends with a period.")).toBe(false);
  });

  it("should reconstruct document structure with page, paragraph, and sentence coordinates", () => {
    const pageData = [
      {
        pageNumber: 1,
        text: "Chapter 1: Foundations\n\nRetrieval practice is essential. It reinforces memory.\n\nSocratic questioning builds comprehension.",
      },
    ];

    const parsed = extractDocumentStructure(pageData);

    expect(parsed.pageCount).toBe(1);
    expect(parsed.pages[0].paragraphs.length).toBe(3);
    expect(parsed.pages[0].paragraphs[0].headingContext).toBe("Chapter 1: Foundations");
    expect(parsed.pages[0].paragraphs[1].sentences.length).toBe(2);
  });
});
