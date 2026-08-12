import OpenAI from "openai";
import { config } from "@/lib/config";
import { ProviderError, AppError } from "@/lib/errors";

export const EMBEDDING_DIMENSION = 1536;
export const MAX_BATCH_SIZE = 96;
export const TIMEOUT_MS = 10000;
export const MAX_RETRIES = 3;

/**
 * Creates an OpenAI client instance.
 */
function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new ProviderError("OPENAI_API_KEY is not configured", { provider: "openai" });
  }
  return new OpenAI({ apiKey: key });
}

/**
 * Generates vector embeddings for a batch of text strings (max 96 per call).
 * Handles batching, 1536d validation, exponential backoff retries, and timeouts.
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey?: string
): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Slice into batches of MAX_BATCH_SIZE if needed
  if (texts.length > MAX_BATCH_SIZE) {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const batchEmbeddings = await generateEmbeddingsBatch(batch, apiKey);
      results.push(...batchEmbeddings);
    }
    return results;
  }

  return generateEmbeddingsBatch(texts, apiKey);
}

/**
 * Internal function to generate embeddings for a single batch <= 96 items.
 */
async function generateEmbeddingsBatch(
  batch: string[],
  apiKey?: string
): Promise<number[][]> {
  const openai = getOpenAIClient(apiKey);
  const model = config.EMBEDDING_MODEL || "text-embedding-3-small";

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await openai.embeddings.create(
        {
          model,
          input: batch,
        },
        {
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response || !Array.isArray(response.data)) {
        throw new ProviderError("Invalid response format from OpenAI embeddings API", {
          response,
        });
      }

      // Sort data by index to guarantee input order preservation
      const sortedData = [...response.data].sort((a, b) => a.index - b.index);
      const embeddings = sortedData.map((d) => d.embedding);

      // Validate dimension length === 1536 for every returned vector
      for (let i = 0; i < embeddings.length; i++) {
        if (!embeddings[i] || embeddings[i].length !== EMBEDDING_DIMENSION) {
          throw new ProviderError(
            `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${
              embeddings[i]?.length ?? 0
            }`,
            { expected: EMBEDDING_DIMENSION, actual: embeddings[i]?.length ?? 0 }
          );
        }
      }

      return embeddings;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry dimension mismatch errors or invalid API key errors
      if (
        lastError instanceof ProviderError &&
        lastError.message.includes("dimension mismatch")
      ) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }

  throw new ProviderError(
    `Failed to generate embeddings after ${MAX_RETRIES} attempts: ${
      lastError?.message ?? "Unknown error"
    }`,
    { lastError: lastError?.message }
  );
}

/**
 * Convenience helper to generate an embedding vector for a single query string.
 */
export async function generateSingleEmbedding(
  text: string,
  apiKey?: string
): Promise<number[]> {
  const results = await generateEmbeddings([text], apiKey);
  if (!results[0] || results[0].length !== EMBEDDING_DIMENSION) {
    throw new AppError(
      `Failed to generate single query embedding`,
      500,
      "EMBEDDING_GENERATION_FAILED"
    );
  }
  return results[0];
}
