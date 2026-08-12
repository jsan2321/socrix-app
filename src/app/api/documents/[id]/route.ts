import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/db/documents";
import { AppError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const doc = await getDocumentById(id);

    return NextResponse.json({
      documentId: doc.id,
      title: doc.title,
      status: doc.status,
      failureReason: doc.failure_reason,
      chunksEmbeddedCount: doc.chunks_embedded_count,
      pageCount: doc.page_count,
      chunksTotal: doc.chunks_total,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    });
  } catch (err: unknown) {
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
          message: `Failed to retrieve document status: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
