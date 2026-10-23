import { countTokens } from "@/utils/tokenize";
import { ParsedDocument, ParsedSentence } from "@/lib/pdf/structure-extraction";

export interface SemanticChunk {
  documentId: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  paragraphStart: number;
  paragraphEnd: number;
  sentenceStart: number;
  sentenceEnd: number;
  heading: string | null;
  text: string;
  tokenCount: number;
  truncatedSplit?: boolean;
}

interface SentenceWithCoords extends ParsedSentence {
  pageNumber: number;
  paragraphIndex: number;
  headingContext: string | null;
}

const TARGET_MIN_TOKENS = 300;
const TARGET_MAX_TOKENS = 500;
const ABSOLUTE_MIN_TOKENS = 100;
const ABSOLUTE_MAX_TOKENS = 600;

/**
 * Semantic chunking algorithm with coordinate tracking.
 */
export function chunkParsedDocument(
  parsedDoc: ParsedDocument,
  documentId: string
): SemanticChunk[] {
  // Flatten all sentences with coordinates
  const flatSentences: SentenceWithCoords[] = [];

  for (const page of parsedDoc.pages) {
    for (const paragraph of page.paragraphs) {
      for (const sentence of paragraph.sentences) {
        flatSentences.push({
          ...sentence,
          pageNumber: page.pageNumber,
          paragraphIndex: paragraph.paragraphIndex,
          headingContext: paragraph.headingContext,
        });
      }
    }
  }

  if (flatSentences.length === 0) return [];

  const chunks: SemanticChunk[] = [];
  let currentBuffer: SentenceWithCoords[] = [];
  let currentTokenCount = 0;

  function flushBuffer(overlapCount = 2, isFinal = false): void {
    if (currentBuffer.length === 0) return;

    const chunkText = currentBuffer.map((s) => s.text).join(" ");
    const tokenCount = countTokens(chunkText);

    // If chunk is below minimum (100) and not final, wait to accumulate more
    if (tokenCount < ABSOLUTE_MIN_TOKENS && !isFinal && chunks.length > 0) {
      // Merge with previous chunk if previous + current <= 600
      const prevChunk = chunks[chunks.length - 1];
      const mergedText = prevChunk.text + " " + chunkText;
      const mergedTokens = countTokens(mergedText);
      if (mergedTokens <= ABSOLUTE_MAX_TOKENS) {
        prevChunk.text = mergedText;
        prevChunk.tokenCount = mergedTokens;
        prevChunk.pageEnd = currentBuffer[currentBuffer.length - 1].pageNumber;
        prevChunk.paragraphEnd = currentBuffer[currentBuffer.length - 1].paragraphIndex;
        prevChunk.sentenceEnd = currentBuffer[currentBuffer.length - 1].sentenceIndex;
        currentBuffer = [];
        currentTokenCount = 0;
        return;
      }
    }

    const firstSentence = currentBuffer[0];
    const lastSentence = currentBuffer[currentBuffer.length - 1];

    chunks.push({
      documentId,
      chunkIndex: chunks.length,
      pageStart: firstSentence.pageNumber,
      pageEnd: lastSentence.pageNumber,
      paragraphStart: firstSentence.paragraphIndex,
      paragraphEnd: lastSentence.paragraphIndex,
      sentenceStart: firstSentence.sentenceIndex,
      sentenceEnd: lastSentence.sentenceIndex,
      heading: firstSentence.headingContext ?? null,
      text: chunkText,
      tokenCount,
    });

    // Retain 1-2 sentences for overlap in next buffer
    if (!isFinal && currentBuffer.length > overlapCount) {
      const overlapSentences = currentBuffer.slice(-overlapCount);
      currentBuffer = [...overlapSentences];
      currentTokenCount = countTokens(currentBuffer.map((s) => s.text).join(" "));
    } else {
      currentBuffer = [];
      currentTokenCount = 0;
    }
  }

  for (let i = 0; i < flatSentences.length; i++) {
    const s = flatSentences[i];
    const sTokens = countTokens(s.text);

    // Forced-split handling for anomalous >600 token sentence
    if (sTokens > ABSOLUTE_MAX_TOKENS) {
      if (currentBuffer.length > 0) flushBuffer(0, false);

      // Split large sentence at whitespace boundary
      const words = s.text.split(/\s+/);
      let wordBuffer: string[] = [];
      let wordTokens = 0;

      for (const word of words) {
        const wt = countTokens(word);
        if (wordTokens + wt > TARGET_MAX_TOKENS && wordBuffer.length > 0) {
          const splitText = wordBuffer.join(" ");
          chunks.push({
            documentId,
            chunkIndex: chunks.length,
            pageStart: s.pageNumber,
            pageEnd: s.pageNumber,
            paragraphStart: s.paragraphIndex,
            paragraphEnd: s.paragraphIndex,
            sentenceStart: s.sentenceIndex,
            sentenceEnd: s.sentenceIndex,
            heading: s.headingContext ?? null,
            text: splitText,
            tokenCount: countTokens(splitText),
            truncatedSplit: true,
          });
          wordBuffer = [];
          wordTokens = 0;
        }
        wordBuffer.push(word);
        wordTokens += wt;
      }

      if (wordBuffer.length > 0) {
        const splitText = wordBuffer.join(" ");
        chunks.push({
          documentId,
          chunkIndex: chunks.length,
          pageStart: s.pageNumber,
          pageEnd: s.pageNumber,
          paragraphStart: s.paragraphIndex,
          paragraphEnd: s.paragraphIndex,
          sentenceStart: s.sentenceIndex,
          sentenceEnd: s.sentenceIndex,
          heading: s.headingContext ?? null,
          text: splitText,
          tokenCount: countTokens(splitText),
          truncatedSplit: true,
        });
      }
      continue;
    }

    if (currentTokenCount + sTokens > TARGET_MAX_TOKENS && currentBuffer.length > 0) {
      flushBuffer(2, false);
    }

    currentBuffer.push(s);
    currentTokenCount += sTokens;

    if (currentTokenCount >= TARGET_MIN_TOKENS && currentTokenCount <= TARGET_MAX_TOKENS) {
      flushBuffer(2, false);
    }
  }

  if (currentBuffer.length > 0) {
    flushBuffer(0, true);
  }

  return chunks;
}
