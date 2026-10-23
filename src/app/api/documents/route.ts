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
import { AppError, ValidationError } from "@/lib/errors";
import { enforceDistributedRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limit";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import { getDashboardDocuments } from "@/lib/db/dashboard";

import { sanitizeTextForPostgres } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 12) || 12));
    const result = await getDashboardDocuments(user.id, page, limit);
    return NextResponse.json({ ...result, page, limit, hasMore: page * limit < result.total });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to retrieve document library");
  }
}

export async function POST(req: Request) {
  let rateLimitHeaders: Record<string, string> = {};
  try {
    // Enforce rate limit (5 uploads/hour per IP/user)
    const rateLimitResult = await enforceDistributedRateLimit(req, {
      keyPrefix: "documents",
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

    // Authenticate after rate limiting so every response retains abuse-control headers.
    const user = await requireAuthenticatedUser();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const titleInput = formData.get("title") as string | null;

    if (!file) {
      throw new ValidationError("Missing required 'file' field in multipart form-data upload");
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // 1. Validate PDF binary (MIME, Magic Bytes %PDF-, size, SHA-256 hash)
    const validation = validatePdfFile(fileBuffer, file.type);

    // 2. Duplicate SHA-256 detection against ready documents
    const existingDoc = await getReadyDocumentByHash(validation.contentHash, user.id);
    if (existingDoc) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "Document with matching SHA-256 hash already exists",
            details: {
              documentId: existingDoc.id,
              status: "ready",
            },
          },
          documentId: existingDoc.id,
          status: "ready",
          message: "Document with matching SHA-256 hash already exists",
        },
        { status: 409, headers: rateLimitHeaders }
      );
    }

    const rawTitle = titleInput?.trim() || file.name || "Untitled PDF Document";
    const documentTitle = sanitizeTextForPostgres(rawTitle);

    // 3. Create 'processing' document record
    const documentRow = await createDocument({
      userId: user.id,
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

      // 7b. Pre-persist unembedded chunks so /api/documents/[id]/continue can resume if interrupted
      try {
        await insertDocumentChunks(
          chunks.map((c) => ({
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
            embedding: null,
          }))
        );
      } catch {
        // Fallback gracefully if migration 0013 (nullable embedding) is not yet applied
      }

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
        { status: 201, headers: rateLimitHeaders }
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
    return formatErrorResponse(err, "Unhandled ingestion failure", rateLimitHeaders);
  }
}
