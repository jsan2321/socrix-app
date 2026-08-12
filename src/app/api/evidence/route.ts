import { NextResponse } from "next/server";
import { EvidenceRequestSchema } from "@/schemas/api";
import { getSessionById, updateAnswerEvidenceViewed } from "@/lib/db/sessions";
import { getQuizQuestionById, getQuizStatementsByQuestionId } from "@/lib/db/quiz";
import { selectEvidenceForQuestion } from "@/lib/rag/evidence";
import { AppError, NotFoundError, UnprocessableEntityError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = EvidenceRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload for evidence retrieval",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { sessionId, questionId } = parseResult.data;

    // 1. Fetch user session to identify document_id
    const session = await getSessionById(sessionId);

    // 2. Fetch quiz question and statements
    const question = await getQuizQuestionById(questionId);
    const statements = await getQuizStatementsByQuestionId(questionId);

    // Find the true statement for grounding evidence query
    const trueStatement = statements.find((s) => s.is_true);
    if (!trueStatement) {
      throw new UnprocessableEntityError(
        `Question ${questionId} does not have a designated true statement`
      );
    }

    // 3. Select evidence using RAG evidence service
    const evidence = await selectEvidenceForQuestion({
      documentId: session.document_id,
      concept: question.concept,
      trueStatementText: trueStatement.text,
      originChunkIds: question.grounding_chunk_ids,
    });

    // 4. Update evidence_viewed flag for recorded answer if present
    try {
      await updateAnswerEvidenceViewed(sessionId, questionId, true);
    } catch {
      // Ignore if answer has not been recorded yet
    }

    return NextResponse.json({ evidence }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof NotFoundError || err instanceof UnprocessableEntityError) {
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
          message: `Failed to retrieve evidence: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
