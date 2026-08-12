import { NextResponse } from "next/server";
import { CreateSessionSchema } from "@/schemas/api";
import { getDocumentById } from "@/lib/db/documents";
import { createSession } from "@/lib/db/sessions";
import { AppError, NotFoundError, UnprocessableEntityError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parseResult = CreateSessionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid session creation payload",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { documentId, mode } = parseResult.data;

    // Verify document exists and status = 'ready'
    const document = await getDocumentById(documentId);
    if (document.status !== "ready") {
      throw new UnprocessableEntityError(
        `Cannot create study session for document in '${document.status}' status (must be 'ready')`
      );
    }

    const sessionToken = crypto.randomUUID();
    const session = await createSession({
      documentId: document.id,
      sessionToken,
      mode,
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        sessionToken: session.session_token,
      },
      { status: 201 }
    );
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
          message: `Failed to create session: ${message}`,
        },
      },
      { status: 500 }
    );
  }
}
