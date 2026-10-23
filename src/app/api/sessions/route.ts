import { NextResponse } from "next/server";
import { CreateSessionSchema } from "@/schemas/api";
import { getDocumentById } from "@/lib/db/documents";
import { createSession } from "@/lib/db/sessions";
import { UnprocessableEntityError } from "@/lib/errors";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser, requireResourceOwner } from "@/lib/auth/require-user";
import { getDashboardSessions } from "@/lib/db/dashboard";

export async function GET(req: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const result = await getDashboardSessions(user.id, page, limit);
    return NextResponse.json({ ...result, page, limit, hasMore: page * limit < result.total });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to retrieve study sessions");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser();
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

    const { documentId, mode, questionTarget, quizLanguage } = parseResult.data;

    // Verify document exists and status = 'ready'
    const document = await getDocumentById(documentId);
    requireResourceOwner(document.user_id, user.id, "Document");
    if (document.status !== "ready") {
      throw new UnprocessableEntityError(
        `Cannot create study session for document in '${document.status}' status (must be 'ready')`
      );
    }

    const sessionToken = crypto.randomUUID();
    const session = await createSession({
      userId: user.id,
      documentId: document.id,
      sessionToken,
      mode,
      questionTarget,
      quizLanguage,
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        sessionToken: session.session_token,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to create session");
  }
}
