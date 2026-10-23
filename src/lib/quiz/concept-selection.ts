import { getChunksWithoutEmbeddingByDocumentId } from "@/lib/db/chunks";
import { UnprocessableEntityError } from "@/lib/errors";
import type { DocumentChunkRow } from "@/schemas/db";

export interface ConceptSelectionResult {
  selectedChunk: DocumentChunkRow;
  conceptTitle: string;
  sourceContext: string;
}

/**
 * Selects an un-tested chunk from a document for quiz generation.
 * Prioritizes factual density (token count >= 150 + heading presence).
 * Throws 422 document_exhausted when all chunks have been tested.
 */
export async function selectConceptChunk(
  documentId: string,
  excludeChunkIds: string[] = [],
  quizLanguage: "auto" | "en" | "es" = "auto"
): Promise<ConceptSelectionResult> {
  const allChunks = await getChunksWithoutEmbeddingByDocumentId(documentId);

  const excludeSet = new Set(excludeChunkIds);
  const candidateChunks = allChunks.filter((c) => !excludeSet.has(c.id));

  if (candidateChunks.length === 0) {
    throw new UnprocessableEntityError(
      "All concepts/chunks in this document have already been tested in this session",
      { failureReason: "document_exhausted" }
    );
  }

  // Prioritize chunks with token count >= 150 and heading context
  const highDensityChunks = candidateChunks.filter(
    (c) => c.token_count >= 150 && c.heading !== null && c.heading !== undefined
  );

  const pool = highDensityChunks.length > 0 ? highDensityChunks : candidateChunks;

  // Pick deterministic/first candidate chunk from pool
  const selectedChunk = pool[0];

  const fallbackLabel =
    quizLanguage === "es"
      ? `Sección (Página ${selectedChunk.page_start})`
      : `Section (Page ${selectedChunk.page_start})`;

  const conceptTitle = selectedChunk.heading
    ? selectedChunk.heading
    : fallbackLabel;

  return {
    selectedChunk,
    conceptTitle,
    sourceContext: selectedChunk.text,
  };
}
