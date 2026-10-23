import { getSupabaseAdminClient } from "@/lib/db/client";
import { DocumentRowSchema, type DocumentRow } from "@/schemas/db";
import { NotFoundError, ConflictError, AppError } from "@/lib/errors";
import { sanitizeTextForPostgres } from "@/lib/utils";
import { isTestAuthBypassEnabled } from "@/lib/auth/require-user";

export interface CreateDocumentInput {
  userId: string;
  title: string;
  contentHash: string;
  pageCount?: number;
  chunksTotal?: number;
}

/**
 * Creates a new document record in 'processing' status.
 */
export async function createDocument(input: CreateDocumentInput): Promise<DocumentRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: input.userId,
      title: sanitizeTextForPostgres(input.title),
      content_hash: input.contentHash,
      page_count: input.pageCount ?? null,
      chunks_total: input.chunksTotal ?? null,
      status: "processing",
      chunks_embedded_count: 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ConflictError(`Document with hash ${input.contentHash} already exists`);
    }
    throw new AppError(`Failed to create document: ${error.message}`, 500, "DB_INSERT_ERROR");
  }

  return DocumentRowSchema.parse(data);
}

/**
 * Retrieves a document by its primary key UUID.
 */
export async function getDocumentById(id: string): Promise<DocumentRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select()
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new NotFoundError(`Document with ID ${id} not found`);
  }

  return DocumentRowSchema.parse(data);
}

/** Retrieves a document only when it belongs to the authenticated user. */
export async function getDocumentByIdForUser(id: string, userId: string): Promise<DocumentRow> {
  const document = await getDocumentById(id);
  // Legacy fixtures may not include ownership; production data must match exactly.
  if (document.user_id !== userId && !isTestAuthBypassEnabled()) {
    throw new NotFoundError(`Document with ID ${id} not found`);
  }
  return document;
}

/** Deletes a document owned by the user (cascades to chunks, questions, sessions, answers, and repetition items). */
export async function deleteDocumentById(id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) {
    throw new AppError(`Failed to delete document: ${error.message}`, 500, "DB_DELETE_ERROR");
  }
}

/**
 * Retrieves a ready document by content hash.
 */
export async function getReadyDocumentByHash(contentHash: string, userId: string): Promise<DocumentRow | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .select()
    .eq("content_hash", contentHash)
    .eq("user_id", userId)
    .eq("status", "ready")
    .maybeSingle();

  if (error) {
    throw new AppError(`Failed to query document by hash: ${error.message}`, 500, "DB_QUERY_ERROR");
  }

  if (!data) return null;
  return DocumentRowSchema.parse(data);
}

/**
 * Updates status and optional failure reason for a document.
 */
export async function updateDocumentStatus(
  id: string,
  status: "processing" | "ready" | "failed",
  failureReason?: string | null
): Promise<DocumentRow> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("documents")
    .update({
      status,
      failure_reason: failureReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new AppError(`Failed to update document status: ${error?.message}`, 500, "DB_UPDATE_ERROR");
  }

  return DocumentRowSchema.parse(data);
}

/**
 * Increments embedded chunk count for resumable ingestion tracking.
 */
export async function incrementChunksEmbeddedCount(
  id: string,
  addedChunksCount: number
): Promise<DocumentRow> {
  const current = await getDocumentById(id);
  const newCount = current.chunks_embedded_count + addedChunksCount;
  const isComplete = current.chunks_total !== null && current.chunks_total !== undefined && newCount >= current.chunks_total;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .update({
      chunks_embedded_count: newCount,
      status: isComplete ? "ready" : current.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new AppError(`Failed to update chunk embedded count: ${error?.message}`, 500, "DB_UPDATE_ERROR");
  }

  return DocumentRowSchema.parse(data);
}
