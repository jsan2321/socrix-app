import { NextResponse } from "next/server";
import { getSessionById, getSessionAnswersWithQuestions } from "@/lib/db/sessions";
import { getDocumentById } from "@/lib/db/documents";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { computeRollingGap } from "@/lib/confidence/gap";
import {
  buildSessionExportData,
  type RawAnswerForExport,
} from "@/lib/export/results-card";
import { formatErrorResponse } from "@/lib/api-response";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid session ID format",
          },
        },
        { status: 400 }
      );
    }

    // 1. Fetch study session
    const session = await getSessionById(sessionId);

    // 2. Fetch associated document title
    const document = await getDocumentById(session.document_id);

    // 3. Fetch session answers
    const answersWithConcepts = await getSessionAnswersWithQuestions(sessionId);

    const questionIds = Array.from(
      new Set(answersWithConcepts.map((a) => a.question_id))
    );

    const supabase = getSupabaseAdminClient();

    // 4. Fetch questions and statements for grounding rationale and excerpts
    const { data: questionsData } =
      questionIds.length > 0
        ? await supabase
            .from("quiz_questions")
            .select("id, concept, grounding_chunk_ids")
            .in("id", questionIds)
        : { data: [] };

    const { data: statementsData } =
      questionIds.length > 0
        ? await supabase
            .from("quiz_statements")
            .select("id, question_id, text, is_true, grounding_rationale")
            .in("id", questionIds)
        : { data: [] };

    // Map question IDs to grounding chunk IDs
    const chunkIds = Array.from(
      new Set(
        (questionsData ?? []).flatMap((q) => q.grounding_chunk_ids ?? [])
      )
    );

    const { data: chunksData } =
      chunkIds.length > 0
        ? await supabase
            .from("document_chunks")
            .select("id, heading, text")
            .in("id", chunkIds)
        : { data: [] };

    const chunkMap = new Map<string, string>();
    for (const chunk of chunksData ?? []) {
      const label = chunk.heading ? `${chunk.heading}: ` : "";
      chunkMap.set(chunk.id, `${label}${chunk.text}`.slice(0, 280));
    }

    const questionChunkMap = new Map<string, string[]>();
    for (const q of questionsData ?? []) {
      questionChunkMap.set(q.id, q.grounding_chunk_ids ?? []);
    }

    // Map rationale from statements
    const rationaleMap = new Map<string, string>();
    for (const s of statementsData ?? []) {
      if (s.grounding_rationale) {
        rationaleMap.set(s.question_id, s.grounding_rationale);
      }
    }

    // 5. Build raw answers array for export builder
    const rawAnswers: RawAnswerForExport[] = answersWithConcepts.map((a) => {
      const qChunkIds = questionChunkMap.get(a.question_id) ?? [];
      const excerpt = qChunkIds.length > 0 ? chunkMap.get(qChunkIds[0]) : null;

      return {
        id: a.id,
        question_id: a.question_id,
        is_correct: a.is_correct,
        confidence_level: a.confidence_level,
        evidence_viewed: a.evidence_viewed,
        answered_at: a.answered_at,
        concept: a.concept,
        grounding_rationale: rationaleMap.get(a.question_id) ?? null,
        source_excerpt: excerpt ?? null,
      };
    });

    const rollingGap = computeRollingGap(rawAnswers, 5);

    const url = new URL(req.url);
    const origin = url.origin;
    const shareUrl = `${origin}/share/${session.id}`;

    // 6. Build sanitized, learner-first export data
    const exportData = buildSessionExportData({
      sessionId: session.id,
      documentTitle: document.title,
      createdAt: session.created_at,
      mode: session.mode,
      rollingGap,
      answers: rawAnswers,
      shareUrl,
    });

    // Check query params
    const format = url.searchParams.get("format");
    const download = url.searchParams.get("download") === "true";

    if (format === "text") {
      return new Response(exportData.shareableSummaryText, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "private, no-transform, max-age=60",
        },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-transform, max-age=60",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="socratic-dossier-${session.id}.json"`;
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to export study session data");
  }
}
