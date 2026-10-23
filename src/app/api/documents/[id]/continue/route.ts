import { NextResponse } from "next/server";
import {
  getDocumentById,
  updateDocumentStatus,
  incrementChunksEmbeddedCount,
} from "@/lib/db/documents";
import { getChunksByDocumentId, insertDocumentChunks } from "@/lib/db/chunks";
import { generateEmbeddings, MAX_BATCH_SIZE } from "@/lib/ai/embeddings";
import { UnprocessableEntityError } from "@/lib/errors";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser, requireResourceOwner } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const user = await requireAuthenticatedUser();
    const document = await getDocumentById(documentId);
    requireResourceOwner(document.user_id, user.id, "Document");

    if (document.status === "ready") {
      return NextResponse.json({
        documentId: document.id,
        status: "ready",
        chunksEmbeddedCount: document.chunks_embedded_count,
        message: "Document is already fully embedded",
      });
    }

    if (document.status === "failed") {
      throw new UnprocessableEntityError(
        `Cannot resume ingestion for failed document (reason: ${
          document.failure_reason ?? "unknown"
        })`
      );
    }

    const allChunks = await getChunksByDocumentId(documentId);
    const pendingChunks = allChunks.filter(
      (c) => !c.embedding || c.embedding.length === 0 || c.chunk_index >= document.chunks_embedded_count
    );

    if (pendingChunks.length === 0) {
      if (document.chunks_total !== null && document.chunks_total !== undefined && allChunks.length < document.chunks_total) {
        await updateDocumentStatus(documentId, "failed", "embedding_error");
        throw new UnprocessableEntityError(
          `Document ingestion interrupted with missing chunk data (${allChunks.length}/${document.chunks_total} chunks stored)`
        );
      }
      await updateDocumentStatus(documentId, "ready");
      return NextResponse.json({
        documentId: document.id,
        status: "ready",
        chunksEmbeddedCount: document.chunks_embedded_count,
      });
    }

    // Process pending chunks in batches of <= 96
    for (let i = 0; i < pendingChunks.length; i += MAX_BATCH_SIZE) {
      const batch = pendingChunks.slice(i, i + MAX_BATCH_SIZE);
      const batchTexts = batch.map((c) => c.text);
      const embeddings = await generateEmbeddings(batchTexts);

      const insertPayload = batch.map((c, idx) => ({
        documentId: c.document_id,
        chunkIndex: c.chunk_index,
        pageStart: c.page_start,
        pageEnd: c.page_end,
        paragraphStart: c.paragraph_start,
        paragraphEnd: c.paragraph_end,
        sentenceStart: c.sentence_start,
        sentenceEnd: c.sentence_end,
        heading: c.heading ?? null,
        text: c.text,
        tokenCount: c.token_count,
        embedding: embeddings[idx],
      }));

      await insertDocumentChunks(insertPayload);
      await incrementChunksEmbeddedCount(documentId, batch.length);
    }

    await updateDocumentStatus(documentId, "ready");

    return NextResponse.json({
      documentId: document.id,
      status: "ready",
      chunksEmbeddedCount: (document.chunks_total ?? allChunks.length),
    });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to continue document embedding");
  }
}
