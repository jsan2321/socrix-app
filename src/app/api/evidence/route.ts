import { NextResponse } from "next/server";
import { EvidenceRequestSchema } from "@/schemas/api";
import { getSessionById, updateAnswerEvidenceViewed } from "@/lib/db/sessions";
import { getQuizQuestionById, getQuizStatementsByQuestionId } from "@/lib/db/quiz";
import { selectEvidenceForQuestion } from "@/lib/rag/evidence";
import { UnprocessableEntityError, ForbiddenError } from "@/lib/errors";
import { enforceDistributedRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limit";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser, requireResourceOwner } from "@/lib/auth/require-user";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireAuthenticatedUser();
    // Enforce rate limit (60 requests/hour per client IP/user)
    const rateLimitResult = await enforceDistributedRateLimit(req, {
      keyPrefix: "ai_operations",
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

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
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { sessionId, questionId } = parseResult.data;

    // 1. Fetch user session to identify document_id
    const session = await getSessionById(sessionId);
    requireResourceOwner(session.user_id, user.id, "Session");

    // 2. Fetch quiz question and statements
    const question = await getQuizQuestionById(questionId);
    if (question.document_id !== session.document_id) {
      throw new ForbiddenError("Question does not belong to this study session");
    }
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
      preferOriginShortcut: true,
    });

    // 4. Update evidence_viewed flag for recorded answer if present
    try {
      await updateAnswerEvidenceViewed(sessionId, questionId, true);
    } catch {
      // Ignore if answer has not been recorded yet
    }

    return NextResponse.json({ evidence }, { status: 200, headers: rateLimitHeaders });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Failed to retrieve evidence");
  }
}
