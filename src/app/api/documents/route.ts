import { NextResponse } from "next/server";
import { validatePdfFile, validateScannedPdfThreshold } from "@/lib/pdf/validation";
import { defaultPdfParser } from "@/lib/pdf/parser";
import { extractDocumentStructure } from "@/lib/pdf/structure-extraction";
import { chunkParsedDocument } from "@/lib/rag/chunking";
import { generateEmbeddings, MAX_BATCH_SIZE } from "@/lib/ai/embeddings";
import { insertDocumentChunks } from "@/lib/db/chunks";
import {
  createDocument,
  getReadyDocumentByHash,
  updateDocumentStatus,
  incrementChunksEmbeddedCount,
} from "@/lib/db/documents";
import { AppError, ConflictError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const titleInput = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required 'file' field in multipart form-data upload",
          },
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 1. Validate PDF binary (MIME, Magic Bytes %PDF-, size ≤50MB, SHA-256 hash)
    const validation = validatePdfFile(fileBuffer, file.type);

    // 2. Duplicate SHA-256 detection against ready documents
    const existingDoc = await getReadyDocumentByHash(validation.contentHash);
    if (existingDoc) {
      return NextResponse.json(
        {
          documentId: existingDoc.id,
          status: "ready",
          message: "Document with matching SHA-256 hash already exists",
        },
        { status: 409 }
      );
    }

    const documentTitle = titleInput?.trim() || file.name || "Untitled PDF Document";

    // 3. Create 'processing' document record
    const documentRow = await createDocument({
      title: documentTitle,
      contentHash: validation.contentHash,
    });

    try {
      // 4. Parse page text
      const parseResult = await defaultPdfParser.parse(fileBuffer);

      // 5. Extract document structure (pages -> paragraphs -> sentences -> headings)
      const parsedDoc = extractDocumentStructure(parseResult.pages);

      // 6. Check scanned PDF threshold
      validateScannedPdfThreshold(parsedDoc.totalCharacters, parsedDoc.pageCount);

      // 7. Execute semantic chunking
      const chunks = chunkParsedDocument(parsedDoc, documentRow.id);

      // Update total counts on document
      const supabase = (await import("@/lib/db/client")).getSupabaseAdminClient();
      await supabase
        .from("documents")
        .update({
          page_count: parsedDoc.pageCount,
          chunks_total: chunks.length,
        })
        .eq("id", documentRow.id);

      // 8. Generate vector embeddings and persist in batches of <= 96
      for (let i = 0; i < chunks.length; i += MAX_BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + MAX_BATCH_SIZE);
        const batchTexts = batchChunks.map((c) => c.text);
        const batchEmbeddings = await generateEmbeddings(batchTexts);

        const insertPayload = batchChunks.map((c, idx) => ({
          documentId: documentRow.id,
          chunkIndex: c.chunkIndex,
          pageStart: c.pageStart,
          pageEnd: c.pageEnd,
          paragraphStart: c.paragraphStart,
          paragraphEnd: c.paragraphEnd,
          sentenceStart: c.sentenceStart,
          sentenceEnd: c.sentenceEnd,
          heading: c.heading ?? null,
          text: c.text,
          tokenCount: c.tokenCount,
          embedding: batchEmbeddings[idx],
        }));

        await insertDocumentChunks(insertPayload);
        await incrementChunksEmbeddedCount(documentRow.id, batchChunks.length);
      }

      // Mark document status as ready
      await updateDocumentStatus(documentRow.id, "ready");

      return NextResponse.json(
        {
          documentId: documentRow.id,
          status: "ready",
          pageCount: parsedDoc.pageCount,
          chunksTotal: chunks.length,
          chunksEmbeddedCount: chunks.length,
        },
        { status: 201 }
      );
    } catch (ingestErr: unknown) {
      let failureReason = "unknown";
      if (
        ingestErr instanceof AppError &&
        ingestErr.details &&
        typeof ingestErr.details === "object" &&
        "failureReason" in ingestErr.details
      ) {
        failureReason = String((ingestErr.details as Record<string, unknown>).failureReason);
      } else if (ingestErr instanceof AppError && ingestErr.code === "ENCRYPTED_PDF") {
        failureReason = "encrypted";
      } else if (ingestErr instanceof AppError && ingestErr.code === "BAD_GATEWAY") {
        failureReason = "embedding_error";
      }

      await updateDocumentStatus(documentRow.id, "failed", failureReason);
      throw ingestErr;
    }
  } catch (err: unknown) {
    if (err instanceof ConflictError) {
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
          message: `Unhandled ingestion failure: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
