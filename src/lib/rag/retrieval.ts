import { generateSingleEmbedding } from "@/lib/ai/embeddings";
import { similaritySearchChunks, type SimilarityMatch } from "@/lib/db/chunks";

export interface RetrievalOptions {
  topK?: number;
  similarityThreshold?: number;
  apiKey?: string;
}

export const DEFAULT_TOP_K = 5;
export const DEFAULT_SIMILARITY_THRESHOLD = 0.70;

/**
 * Embeds a search query and retrieves the top-k most similar document chunks
 * from pgvector for a specified document.
 */
export async function retrieveSimilarChunks(
  documentId: string,
  queryText: string,
  options: RetrievalOptions = {}
): Promise<SimilarityMatch[]> {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;

  // 1. Embed query using identical model and dimension as ingestion
  const queryEmbedding = await generateSingleEmbedding(queryText, options.apiKey);

  // 2. Perform pgvector similarity search
  const matches = await similaritySearchChunks(
    documentId,
    queryEmbedding,
    topK,
    similarityThreshold
  );

  return matches;
}
