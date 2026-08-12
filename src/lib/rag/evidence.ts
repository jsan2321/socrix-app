import { retrieveSimilarChunks } from "@/lib/rag/retrieval";
import { getChunkById } from "@/lib/db/chunks";
import { InsufficientEvidenceError } from "@/lib/errors";
import type { DocumentChunkRow } from "@/schemas/db";

export interface EvidenceResult {
  chunk_id: string;
  document_id: string;
  text: string;
  similarity_score: number;
  page_start: number;
  page_end: number;
  paragraph_start: number;
  paragraph_end: number;
  sentence_start: number;
  sentence_end: number;
  heading: string | null;
  is_origin_chunk: boolean;
}

export interface SelectEvidenceInput {
  documentId: string;
  concept: string;
  trueStatementText: string;
  originChunkIds: string[];
  apiKey?: string;
}

export const ORIGIN_BOOST_WINDOW = 0.05;

/**
 * Construct evidence query from targeted concept and true statement text.
 */
export function constructEvidenceQuery(concept: string, trueStatementText: string): string {
  return `${concept.trim()}: ${trueStatementText.trim()}`;
}

/**
 * Main evidence selection service.
 * Embeds query, performs pgvector search, applies origin-chunk preference boost (FR-RAG-3),
 * attaches provenance coordinates (FR-RAG-4), and executes fallback chain (FR-RAG-6).
 */
export async function selectEvidenceForQuestion(
  input: SelectEvidenceInput
): Promise<EvidenceResult> {
  const { documentId, concept, trueStatementText, originChunkIds, apiKey } = input;

  // 1. Construct query
  const queryText = constructEvidenceQuery(concept, trueStatementText);

  // 2. Perform similarity search (threshold >= 0.70, top 5)
  const matches = await retrieveSimilarChunks(documentId, queryText, {
    topK: 5,
    similarityThreshold: 0.70,
    apiKey,
  });

  const originSet = new Set(originChunkIds);

  // 3. Selection & Origin-chunk preference boost
  if (matches.length > 0) {
    const topMatch = matches[0];

    // Search if an origin chunk is present in candidate matches
    const originMatchIndex = matches.findIndex((m) => originSet.has(m.chunk.id));

    if (originMatchIndex !== -1) {
      const originMatch = matches[originMatchIndex];

      // Boost: If origin chunk's similarity is within 0.05 of the top chunk, pick origin chunk
      if (topMatch.similarity - originMatch.similarity <= ORIGIN_BOOST_WINDOW) {
        return formatEvidenceResult(originMatch.chunk, originMatch.similarity, true);
      }
    }

    // Otherwise select top similarity match
    const isOrigin = originSet.has(topMatch.chunk.id);
    return formatEvidenceResult(topMatch.chunk, topMatch.similarity, isOrigin);
  }

  // 4. Insufficient evidence fallback chain (FR-RAG-6)
  // Fallback 1: Direct lookup of original grounding chunk
  if (originChunkIds.length > 0) {
    for (const chunkId of originChunkIds) {
      try {
        const originChunk = await getChunkById(chunkId);
        if (originChunk) {
          return formatEvidenceResult(originChunk, 0.70, true);
        }
      } catch {
        // Continue to next origin chunk or final error
      }
    }
  }

  // Fallback 2: No evidence available
  throw new InsufficientEvidenceError(
    `No chunk met similarity threshold (>= 0.70) and origin grounding chunk is unavailable for document ${documentId}`
  );
}

function formatEvidenceResult(
  chunk: DocumentChunkRow,
  similarity: number,
  isOrigin: boolean
): EvidenceResult {
  return {
    chunk_id: chunk.id,
    document_id: chunk.document_id,
    text: chunk.text,
    similarity_score: Number(similarity.toFixed(4)),
    page_start: chunk.page_start,
    page_end: chunk.page_end,
    paragraph_start: chunk.paragraph_start,
    paragraph_end: chunk.paragraph_end,
    sentence_start: chunk.sentence_start,
    sentence_end: chunk.sentence_end,
    heading: chunk.heading ?? null,
    is_origin_chunk: isOrigin,
  };
}
