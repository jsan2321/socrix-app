import { getSupabaseAdminClient } from "@/lib/db/client";
import { AppError } from "@/lib/errors";

export type DashboardSession = { id: string; createdAt: string; totalAnswered: number; accuracy: number };
export type DashboardDocument = { id: string; title: string; status: "processing" | "ready" | "failed"; createdAt: string; pageCount: number | null; chunksTotal: number | null; sessions: DashboardSession[]; bestAccuracy: number | null; averageAccuracy: number | null };

function summarizeSession(id: string, createdAt: string, answers: Array<{ is_correct: boolean }> | null): DashboardSession {
  const totalAnswered = answers?.length ?? 0;
  const accuracy = totalAnswered === 0 ? 0 : answers!.filter((answer) => answer.is_correct).length / totalAnswered;
  return { id, createdAt, totalAnswered, accuracy };
}

export async function getDashboardDocuments(userId: string, page: number, limit: number) {
  const supabase = getSupabaseAdminClient();
  const from = (page - 1) * limit;
  const { data: documents, error, count } = await supabase
    .from("documents")
    .select("id,title,status,created_at,page_count,chunks_total", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw new AppError(`Failed to load document library: ${error.message}`, 500, "DB_QUERY_ERROR");
  const documentIds = (documents ?? []).map((document) => document.id);
  if (documentIds.length === 0) return { documents: [] as DashboardDocument[], total: count ?? 0 };

  const { data: sessions, error: sessionError } = await supabase
    .from("user_sessions")
    .select("id,document_id,created_at,session_answers(is_correct)")
    .eq("user_id", userId)
    .in("document_id", documentIds)
    .order("created_at", { ascending: false });
  if (sessionError) throw new AppError(`Failed to load session summaries: ${sessionError.message}`, 500, "DB_QUERY_ERROR");
  const sessionsByDocument = new Map<string, DashboardSession[]>();
  for (const session of sessions ?? []) {
    const summary = summarizeSession(session.id, session.created_at, session.session_answers as Array<{ is_correct: boolean }> | null);
    sessionsByDocument.set(session.document_id, [...(sessionsByDocument.get(session.document_id) ?? []), summary]);
  }
  return {
    total: count ?? 0,
    documents: (documents ?? []).map((document) => {
      const documentSessions = sessionsByDocument.get(document.id) ?? [];
      const completed = documentSessions.filter((session) => session.totalAnswered > 0);
      const accuracies = completed.map((session) => session.accuracy);
      return { id: document.id, title: document.title, status: document.status, createdAt: document.created_at, pageCount: document.page_count, chunksTotal: document.chunks_total, sessions: documentSessions, bestAccuracy: accuracies.length ? Math.max(...accuracies) : null, averageAccuracy: accuracies.length ? accuracies.reduce((sum, accuracy) => sum + accuracy, 0) / accuracies.length : null };
    }),
  };
}

export async function getDashboardSessions(userId: string, page: number, limit: number) {
  const supabase = getSupabaseAdminClient();
  const from = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from("user_sessions")
    .select("id,document_id,created_at,documents(title),session_answers(is_correct)", { count: "exact" })
    .eq("user_id", userId).order("created_at", { ascending: false }).range(from, from + limit - 1);
  if (error) throw new AppError(`Failed to load sessions: ${error.message}`, 500, "DB_QUERY_ERROR");
  return { total: count ?? 0, sessions: (data ?? []).map((session) => {
    const summary = summarizeSession(session.id, session.created_at, session.session_answers as Array<{ is_correct: boolean }> | null);
    const document = session.documents as unknown as { title: string } | null;
    return { ...summary, documentId: session.document_id, documentTitle: document?.title ?? "Untitled document" };
  }) };
}
