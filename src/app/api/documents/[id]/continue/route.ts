import { NextResponse } from "next/server";
import {
  getDocumentById,
  updateDocumentStatus,
  incrementChunksEmbeddedCount,
} from "@/lib/db/documents";
import { getChunksByDocumentId, insertDocumentChunks } from "@/lib/db/chunks";
import { generateEmbeddings, MAX_BATCH_SIZE } from "@/lib/ai/embeddings";
import { AppError, NotFoundError, UnprocessableEntityError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const document = await getDocumentById(documentId);

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
      (c) => c.chunk_index >= document.chunks_embedded_count
    );

    if (pendingChunks.length === 0) {
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
    if (err instanceof NotFoundError || err instanceof UnprocessableEntityError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        { status: err.statusCode }
      );
    }

    if (err instanceof AppError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to continue document embedding: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
