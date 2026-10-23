import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { ZodError } from "zod";
import type { ApiErrorResponse } from "@/schemas/api";

/**
 * Creates a standardized API error response.
 * Ensures typed status codes and prevents raw internal stack traces or database leaks.
 */
export function formatErrorResponse(
  err: unknown,
  fallbackMessage = "An unexpected error occurred",
  headers?: HeadersInit
): NextResponse<ApiErrorResponse> {
  const responseHeaders = new Headers(headers);

  if (err instanceof AppError) {
    if (err.code === "RATE_LIMIT_EXCEEDED" && err.details && typeof err.details === "object") {
      const details = err.details as Record<string, unknown>;
      if (details.limit !== undefined) {
        responseHeaders.set("X-RateLimit-Limit", String(details.limit));
      }
      if (details.remaining !== undefined) {
        responseHeaders.set("X-RateLimit-Remaining", String(details.remaining));
      }
      if (details.retryAfter !== undefined) {
        responseHeaders.set("Retry-After", String(details.retryAfter));
      }
    }

    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      { status: err.statusCode, headers: responseHeaders }
    );
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: err.flatten(),
        },
      },
      { status: 400, headers }
    );
  }

  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: `${fallbackMessage}: ${message}`,
      },
    },
    { status: 500, headers }
  );
}
