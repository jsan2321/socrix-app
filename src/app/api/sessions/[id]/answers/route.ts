import { NextResponse } from "next/server";
import { AnswerSubmissionSchema } from "@/schemas/api";
import { getSessionById, recordSessionAnswer } from "@/lib/db/sessions";
import { getQuizStatementsByQuestionId } from "@/lib/db/quiz";
import { AppError, NotFoundError, ConflictError, UnprocessableEntityError } from "@/lib/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json();

    const parseResult = AnswerSubmissionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid answer submission payload",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { questionId, selectedStatementIds, confidenceLevel } = parseResult.data;

    // 1. Fetch user session to determine quiz mode
    const session = await getSessionById(sessionId);

    // 2. Fetch all statements for the question from DB
    const statements = await getQuizStatementsByQuestionId(questionId);
    if (statements.length !== 3) {
      throw new UnprocessableEntityError(
        `Question ${questionId} does not have 3 statements in database`
      );
    }

    const selectedSet = new Set(selectedStatementIds);
    const trueStatement = statements.find((s) => s.is_true);
    const trueStatementId = trueStatement?.id;

    if (!trueStatementId) {
      throw new UnprocessableEntityError(
        `Question ${questionId} missing ground-truth statement`
      );
    }

    // 3. Mode-aware correctness computation (FR-QUIZ-10)
    let isCorrect = false;

    if (session.mode === "identify_truth") {
      // Correct iff exactly 1 statement selected AND selected statement is true
      isCorrect = selectedStatementIds.length === 1 && selectedSet.has(trueStatementId);
    } else if (session.mode === "identify_both_lies") {
      // Correct iff exactly 2 statements selected AND both are lies (i.e. neither is trueStatementId)
      isCorrect = selectedStatementIds.length === 2 && !selectedSet.has(trueStatementId);
    }

    // 4. Record answer atomically
    await recordSessionAnswer({
      sessionId,
      questionId,
      selectedStatementIds,
      isCorrect,
      confidenceLevel,
    });

    return NextResponse.json(
      {
        correct: isCorrect,
        correctStatementIds: [trueStatementId],
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    if (err instanceof ConflictError) {
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
          message: `Failed to record answer: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
