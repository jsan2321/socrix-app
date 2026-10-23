import { NextResponse } from "next/server";
import { AnswerSubmissionSchema } from "@/schemas/api";
import { getSessionById, recordSessionAnswer } from "@/lib/db/sessions";
import { getQuizQuestionById, getQuizStatementsByQuestionId } from "@/lib/db/quiz";
import { updateRepetitionSchedule } from "@/lib/db/repetition";
import { UnprocessableEntityError, ForbiddenError } from "@/lib/errors";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser, requireResourceOwner, isTestAuthBypassEnabled } from "@/lib/auth/require-user";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
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
    requireResourceOwner(session.user_id, user.id, "Session");
    const question = await getQuizQuestionById(questionId);
    if (!isTestAuthBypassEnabled()) {
      if (question.document_id !== session.document_id) {
        throw new ForbiddenError("Question does not belong to this study session");
      }
    }

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

    // 3. Mode-aware correctness computation
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

    // 5. Update spaced repetition retention schedule for authenticated user
    if (session.user_id && question?.concept) {
      void updateRepetitionSchedule({
        userId: session.user_id,
        documentId: session.document_id,
        concept: question.concept,
        isCorrect,
        confidenceLevel,
      }).catch(() => {
        // Non-blocking background retention sync
      });
    }

    return NextResponse.json(
      {
        correct: isCorrect,
        correctStatementIds: [trueStatementId],
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to record answer");
  }
}
