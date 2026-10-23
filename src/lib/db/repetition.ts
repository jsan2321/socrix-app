import { getSupabaseAdminClient } from "@/lib/db/client";
import {
  RepetitionScheduleRowSchema,
  type RepetitionScheduleRow,
} from "@/schemas/db";
import {
  calculateQualityFromAnswer,
  calculateSm2,
  type RetentionStatus,
} from "@/lib/repetition/sm2";

export interface DueConceptItem {
  id: string;
  documentId: string;
  documentTitle: string;
  concept: string;
  intervalDays: number;
  repetitionCount: number;
  easeFactor: number;
  nextReviewAt: string;
  status: RetentionStatus;
}

export interface RepetitionStats {
  dueCount: number;
  totalTracked: number;
  masteredCount: number;
}

/**
 * Updates or inserts a repetition schedule row for a user-reviewed concept.
 */
export async function updateRepetitionSchedule(params: {
  userId: string;
  documentId: string;
  concept: string;
  isCorrect: boolean;
  confidenceLevel: number;
}): Promise<RepetitionScheduleRow | null> {
  const { userId, documentId, concept, isCorrect, confidenceLevel } = params;
  if (!userId) return null;

  const supabase = getSupabaseAdminClient();

  // 1. Fetch existing item if any
  const { data: existing } = await supabase
    .from("repetition_schedule")
    .select()
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .eq("concept", concept)
    .maybeSingle();

  const prevRepetitionCount = existing?.repetition_count ?? 0;
  const prevIntervalDays = existing?.interval_days ?? 1;
  const prevEaseFactor = Number(existing?.ease_factor ?? 2.5);

  // 2. Compute SM-2 update
  const quality = calculateQualityFromAnswer(isCorrect, confidenceLevel);
  const sm2Result = calculateSm2({
    repetitionCount: prevRepetitionCount,
    intervalDays: prevIntervalDays,
    easeFactor: prevEaseFactor,
    quality,
  });

  // 3. Upsert record
  const payload = {
    user_id: userId,
    document_id: documentId,
    concept,
    interval_days: sm2Result.intervalDays,
    ease_factor: sm2Result.easeFactor,
    repetition_count: sm2Result.repetitionCount,
    last_reviewed_at: new Date().toISOString(),
    next_review_at: sm2Result.nextReviewAt.toISOString(),
  };

  const { data, error } = await supabase
    .from("repetition_schedule")
    .upsert(payload, { onConflict: "user_id,document_id,concept" })
    .select()
    .single();

  if (error || !data) {
    // Non-blocking for quiz submission
    return null;
  }

  return RepetitionScheduleRowSchema.parse(data);
}

/**
 * Retrieves concepts due for review for an authenticated user.
 */
export async function getDueConceptsForUser(
  userId: string,
  limit: number = 6
): Promise<DueConceptItem[]> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Query concepts where next_review_at <= now, ordered by earliest due
  const { data, error } = await supabase
    .from("repetition_schedule")
    .select(`
      id,
      document_id,
      concept,
      interval_days,
      repetition_count,
      ease_factor,
      next_review_at,
      documents:document_id (title)
    `)
    .eq("user_id", userId)
    .lte("next_review_at", nowIso)
    .order("next_review_at", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row: Record<string, unknown>) => {
    const doc = row.documents as { title?: string } | null;
    const intervalDays = Number(row.interval_days) || 1;
    let status: RetentionStatus = "needs_review";
    if (intervalDays >= 21) {
      status = "mastered";
    } else if (intervalDays >= 6) {
      status = "retained";
    } else {
      status = "strengthening";
    }

    return {
      id: String(row.id),
      documentId: String(row.document_id),
      documentTitle: doc?.title || "Document",
      concept: String(row.concept),
      intervalDays,
      repetitionCount: Number(row.repetition_count) || 0,
      easeFactor: Number(row.ease_factor) || 2.5,
      nextReviewAt: String(row.next_review_at),
      status,
    };
  });
}

/**
 * Returns summary statistics for spaced repetition.
 */
export async function getRepetitionStats(userId: string): Promise<RepetitionStats> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const [dueResult, totalResult, masteredResult] = await Promise.all([
    supabase
      .from("repetition_schedule")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("next_review_at", nowIso),
    supabase
      .from("repetition_schedule")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("repetition_schedule")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("interval_days", 21),
  ]);

  return {
    dueCount: dueResult.count ?? 0,
    totalTracked: totalResult.count ?? 0,
    masteredCount: masteredResult.count ?? 0,
  };
}
