import { NextResponse } from "next/server";
import { SessionResultsResponseSchema } from "@/schemas/api";
import { getSessionById, getSessionAnswersWithQuestions } from "@/lib/db/sessions";
import { getDocumentById } from "@/lib/db/documents";
import { buildConfidenceTracerData } from "@/lib/confidence/tracer";
import { shouldTriggerConfidenceGapAlert } from "@/lib/confidence/alert";
import { AppError, NotFoundError } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    // 1. Fetch user session
    const session = await getSessionById(sessionId);

    // 2. Fetch associated document for title
    const document = await getDocumentById(session.document_id);

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
    if (err instanceof NotFoundError) {
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
          message: `Failed to retrieve session results: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
