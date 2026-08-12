import { PageTextData } from "./parser";

export interface ParsedSentence {
  sentenceIndex: number;
  text: string;
}

export interface ParsedParagraph {
  paragraphIndex: number;
  text: string;
  sentences: ParsedSentence[];
  headingContext: string | null;
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
  paragraphs: ParsedParagraph[];
}

export interface ParsedDocument {
  pageCount: number;
  pages: ParsedPage[];
  totalCharacters: number;
}

/**
 * Splits paragraph text into sentences using abbreviation-safe boundary detection.
 */
export function segmentSentences(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Protect common multi-letter abbreviations, titles, numbers, and single-letter initials
  const protectedText = text
    .replace(/\b(?:e\.g\.|i\.e\.|Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|vs\.|Fig\.|Vol\.|pp\.|p\.|st\.)/gi, (match) =>
      match.replace(/\./g, "___DOT___")
    )
    .replace(/\b([A-Z])\./g, "$1___DOT___")
    .replace(/(\d)\.(\d)/g, "$1___DOT___$2");

  // Split on sentence-ending punctuation followed by whitespace
  const rawSentences = protectedText.split(/(?<=[.!?])\s+/);

  return rawSentences
    .map((s) => s.replace(/___DOT___/g, ".").trim())
    .filter((s) => s.length > 0);
}

/**
 * Detects if a paragraph line is likely a section heading.
 * Heuristic: short line (< 80 chars), title case or numbered prefix, no trailing period.
 */
export function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (trimmed.endsWith(".")) return false;

  // Numbered headings (e.g., "1.2 Section Name", "Chapter 3") or short Title Case
  const isNumbered = /^(?:Chapter\s+\d+|\d+(?:\.\d+)*\s+[A-Z])/i.test(trimmed);
  const isTitleCase = /^[A-Z0-9][A-Za-z0-9\s:\-\–\—]{2,60}$/.test(trimmed);

  return isNumbered || isTitleCase;
}

/**
 * Reconstructs document structure (pages -> paragraphs -> sentences -> headings) from parsed page text.
 */
export function extractDocumentStructure(pages: PageTextData[]): ParsedDocument {
  let totalCharacters = 0;
  let globalParagraphCount = 0;
  let currentHeadingContext: string | null = null;

  const parsedPages: ParsedPage[] = pages.map((page) => {
    totalCharacters += page.text.length;

    // Split page text into raw paragraphs on double-newlines or multi-space breaks
    const rawParagraphs = page.text
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const paragraphs: ParsedParagraph[] = [];

    for (const rawP of rawParagraphs) {
      // Check if this paragraph is itself a heading
      if (isLikelyHeading(rawP)) {
        currentHeadingContext = rawP;
      }

      globalParagraphCount++;
      const sentenceTexts = segmentSentences(rawP);
      const sentences: ParsedSentence[] = sentenceTexts.map((txt, idx) => ({
        sentenceIndex: idx + 1,
        text: txt,
      }));

      paragraphs.push({
        paragraphIndex: globalParagraphCount,
        text: rawP,
        sentences,
        headingContext: currentHeadingContext,
      });
    }

    return {
      pageNumber: page.pageNumber,
      text: page.text,
      paragraphs,
    };
  });

  return {
    pageCount: pages.length,
    pages: parsedPages,
    totalCharacters,
  };
}
