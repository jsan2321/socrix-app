import { NextResponse } from "next/server";
import { SessionResultsResponseSchema } from "@/schemas/api";
import { getSessionById, getSessionAnswersWithQuestions } from "@/lib/db/sessions";
import { getDocumentById } from "@/lib/db/documents";
import { buildConfidenceTracerData } from "@/lib/confidence/tracer";
import { shouldTriggerConfidenceGapAlert } from "@/lib/confidence/alert";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser, requireResourceOwner } from "@/lib/auth/require-user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id: sessionId } = await params;

    // 1. Fetch user session
    const session = await getSessionById(sessionId);
    requireResourceOwner(session.user_id, user.id, "Session");

    // 2. Fetch associated document for title
    const document = await getDocumentById(session.document_id);
    requireResourceOwner(document.user_id, user.id, "Document");

    // 3. Fetch all session answers with question concept metadata
    const answers = await getSessionAnswersWithQuestions(sessionId);

    // 4. Compute metrics
    const totalAnswered = answers.length;
    const correctCount = answers.filter((a) => a.is_correct).length;
    const accuracy =
      totalAnswered > 0 ? Number((correctCount / totalAnswered).toFixed(4)) : 0;

    // 5. Aggregate Confidence Tracer data & Alert status
    const confidenceTracer = buildConfidenceTracerData(answers);
    const confidenceGapAlert = shouldTriggerConfidenceGapAlert(answers);

    // 6. Shape and validate response payload
    const responsePayload = SessionResultsResponseSchema.parse({
      sessionId: session.id,
      documentTitle: document.title,
      totalAnswered,
      accuracy,
      confidenceTracer,
      confidenceGapAlert,
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to retrieve session results");
  }
}
