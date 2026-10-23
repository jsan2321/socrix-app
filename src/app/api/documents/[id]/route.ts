import { NextResponse } from "next/server";
import { getDocumentById, deleteDocumentById } from "@/lib/db/documents";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser, requireResourceOwner } from "@/lib/auth/require-user";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuthenticatedUser();
    const doc = await getDocumentById(id);
    requireResourceOwner(doc.user_id, user.id, "Document");

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
    return formatErrorResponse(err, "Failed to retrieve document status");
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await requireAuthenticatedUser();
    const doc = await getDocumentById(id);
    requireResourceOwner(doc.user_id, user.id, "Document");

    await deleteDocumentById(doc.id);

    return NextResponse.json({
      deleted: true,
      documentId: doc.id,
    });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to delete document");
  }
}
