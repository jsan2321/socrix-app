import { NextResponse } from "next/server";
import { QuizRequestSchema } from "@/schemas/api";
import { generateDevilsAdvocateQuiz } from "@/lib/quiz/generation";
import { AppError, NotFoundError, UnprocessableEntityError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = QuizRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid quiz generation request payload",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { sessionId, excludeChunkIds } = parseResult.data;

    // Generate quiz question via quiz engine service
    const persisted = await generateDevilsAdvocateQuiz({
      sessionId,
      excludeChunkIds,
    });

    // Format response WITHHOLDING isTrue from client for security (SRS §4.2)
    const responsePayload = {
      questionId: persisted.question.id,
      concept: persisted.question.concept,
      difficulty: persisted.question.difficulty,
      statements: persisted.statements.map((s) => ({
        statementId: s.id,
        text: s.text,
        displayOrder: s.display_order,
      })),
    };

    return NextResponse.json(responsePayload, { status: 201 });
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
          message: `Quiz generation failed: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
