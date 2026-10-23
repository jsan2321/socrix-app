import { getSupabaseAdminClient } from "@/lib/db/client";
import { DocumentChunkRowSchema, type DocumentChunkRow } from "@/schemas/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { sanitizeTextForPostgres } from "@/lib/utils";

export interface InsertChunkInput {
  documentId: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  paragraphStart: number;
  paragraphEnd: number;
  sentenceStart: number;
  sentenceEnd: number;
  heading?: string | null;
  text: string;
  tokenCount: number;
  embedding?: number[] | null;
}

/**
 * Batch inserts or upserts semantic document chunks with vector embeddings.
 */
export async function insertDocumentChunks(
  chunks: InsertChunkInput[]
): Promise<DocumentChunkRow[]> {
  if (chunks.length === 0) return [];

  const supabase = getSupabaseAdminClient();

  const payload = chunks.map((c) => ({
    document_id: c.documentId,
    chunk_index: c.chunkIndex,
    page_start: c.pageStart,
    page_end: c.pageEnd,
    paragraph_start: c.paragraphStart,
    paragraph_end: c.paragraphEnd,
    sentence_start: c.sentenceStart,
    sentence_end: c.sentenceEnd,
    heading: c.heading ? sanitizeTextForPostgres(c.heading) : null,
    text: sanitizeTextForPostgres(c.text),
    token_count: c.tokenCount,
    embedding: c.embedding ?? null,
  }));

  const query = supabase.from("document_chunks");
  const { data, error } = await (typeof query.upsert === "function"
    ? query.upsert(payload, { onConflict: "document_id,chunk_index" }).select()
    : query.insert(payload).select());

  if (error) {
    throw new AppError(`Failed to insert document chunks: ${error.message}`, 500, "DB_INSERT_ERROR");
  }

  return data.map((row) => DocumentChunkRowSchema.parse(row));
}

export const CHUNK_METADATA_COLUMNS =
  "id, document_id, chunk_index, page_start, page_end, paragraph_start, paragraph_end, sentence_start, sentence_end, heading, text, token_count, created_at";

/**
 * Retrieves all chunks for a document ordered by chunk_index.
 */
export async function getChunksByDocumentId(documentId: string): Promise<DocumentChunkRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_chunks")
    .select()
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch chunks for document: ${error.message}`, 500, "DB_QUERY_ERROR");
  }

  return data.map((row) => DocumentChunkRowSchema.parse(row));
}

/**
 * Retrieves chunks for a document omitting the 1536-dimensional vector embedding
 * to optimize database bandwidth and memory consumption.
 */
export async function getChunksWithoutEmbeddingByDocumentId(
  documentId: string
): Promise<DocumentChunkRow[]> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_chunks")
    .select(CHUNK_METADATA_COLUMNS)
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw new AppError(`Failed to fetch chunks for document: ${error.message}`, 500, "DB_QUERY_ERROR");
  }

  return data.map((row) => DocumentChunkRowSchema.parse(row));
}

/**
 * Retrieves a single document chunk by primary key UUID.
 */
export async function getChunkById(
  id: string,
  options?: { includeEmbedding?: boolean }
): Promise<DocumentChunkRow> {
  const supabase = getSupabaseAdminClient();
  const selectQuery = options?.includeEmbedding === false ? CHUNK_METADATA_COLUMNS : "*";

  const { data, error } = await supabase
    .from("document_chunks")
    .select(selectQuery)
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Document chunk with ID ${id} not found`);
  }

  return DocumentChunkRowSchema.parse(data);
}

export interface SimilarityMatch {
  chunk: DocumentChunkRow;
  similarity: number;
}

/**
 * Performs pgvector cosine similarity search over chunks for a specific document.
 */
export async function similaritySearchChunks(
  documentId: string,
  queryEmbedding: number[],
  matchCount = 5,
  similarityThreshold = 0.70
): Promise<SimilarityMatch[]> {
  const supabase = getSupabaseAdminClient();

  // Call Supabase RPC match_document_chunks if available, or direct query
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_document_id: documentId,
    match_threshold: similarityThreshold,
    match_count: matchCount,
  });

  if (error) {
    // Fallback: fetch chunks and calculate cosine similarity in JS if RPC is unavailable
    const allChunks = await getChunksByDocumentId(documentId);
    const matches: SimilarityMatch[] = [];

    for (const chunk of allChunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;
      const sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (sim >= similarityThreshold) {
        matches.push({ chunk, similarity: sim });
      }
    }

    matches.sort((a, b) => b.similarity - a.similarity);
    return matches.slice(0, matchCount);
  }

  return (data as Array<{ chunk: DocumentChunkRow; similarity: number }>).map((item) => ({
    chunk: DocumentChunkRowSchema.parse(item.chunk),
    similarity: item.similarity,
  }));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
