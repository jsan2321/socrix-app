import { NextResponse } from "next/server";
import { QuizRequestSchema } from "@/schemas/api";
import { generateDevilsAdvocateQuiz } from "@/lib/quiz/generation";
import { enforceDistributedRateLimit, getRateLimitHeaders } from "@/lib/security/rate-limit";
import { formatErrorResponse } from "@/lib/api-response";
import { requireAuthenticatedUser } from "@/lib/auth/require-user";
import type { QuizGenerationResult } from "@/lib/quiz/generation";

export const runtime = "nodejs";
export const maxDuration = 60;

function clientQuestion(persisted: QuizGenerationResult) {
  return {
    questionId: persisted.question.id,
    concept: persisted.question.concept,
    difficulty: persisted.question.difficulty,
    mode: persisted.mode,
    questionTarget: persisted.questionTarget ?? null,
    groundingChunkIds: persisted.question.grounding_chunk_ids || [],
    statements: persisted.statements.map((statement) => ({
      statementId: statement.id,
      text: statement.text,
      displayOrder: statement.display_order,
    })),
  };
}

export async function POST(req: Request) {
  let rateLimitHeaders: Record<string, string> = {};
  try {
    const user = await requireAuthenticatedUser();
    // Enforce rate limit (60 requests/hour per client IP/user)
    const rateLimitResult = await enforceDistributedRateLimit(req, {
      keyPrefix: "ai_operations",
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });
    rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

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
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { sessionId, excludeChunkIds, requestId } = parseResult.data;
    const wantsStream = req.headers.get("accept")?.includes("text/event-stream") ?? false;

    if (wantsStream) {
      if (!requestId) {
        return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Streaming requests require a requestId" } }, { status: 400, headers: rateLimitHeaders });
      }
      const encoder = new TextEncoder();
      let disconnected = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: string, data: unknown) => {
            if (!disconnected) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          };
          void (async () => {
            try {
              const persisted = await generateDevilsAdvocateQuiz({
                sessionId, userId: user.id, excludeChunkIds, requestId,
                onProgress: (status) => send("status", { status }),
              });
              send("question", clientQuestion(persisted));
              send("done", { requestId });
            } catch (error) {
              const response = formatErrorResponse(error, "Quiz generation failed");
              const body = await response.json();
              send("error", body);
            } finally {
              if (!disconnected) controller.close();
            }
          })();
        },
        cancel() { disconnected = true; },
      });
      return new Response(stream, {
        headers: { ...rateLimitHeaders, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
      });
    }

    const persisted = await generateDevilsAdvocateQuiz({
      sessionId,
      userId: user.id,
      excludeChunkIds,
      requestId,
    });

    return NextResponse.json(clientQuestion(persisted), { status: 201, headers: rateLimitHeaders });
  } catch (err: unknown) {
    return formatErrorResponse(err, "Quiz generation failed", rateLimitHeaders);
  }
}
