import { describe, it, expect, beforeEach } from "vitest";
import {
  logAIRequest,
  getCapturedLogs,
  clearCapturedLogs,
  generateRequestId,
  redactSensitiveString,
  sanitizeLogObject,
  AIRequestLog,
} from "@/lib/observability/log";

describe("Observability & Structured Logging (SRS §10)", () => {
  beforeEach(() => {
    clearCapturedLogs();
  });

  it("logs structured AI request conforming to AIRequestLog schema", () => {
    const validLog: AIRequestLog = {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      route: "/api/quiz",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: 1450,
      attempts: 1,
      tokenUsage: { input: 350, output: 120 },
      estimatedCostUsd: 0.0001,
      retryCount: 0,
      outcome: "success",
    };

    const result = logAIRequest(validLog);
    expect(result.requestId).toBe(validLog.requestId);
    expect(result.outcome).toBe("success");

    const captured = getCapturedLogs();
    expect(captured.length).toBe(1);
    expect(captured[0].route).toBe("/api/quiz");
  });

  it("tracks retry counts, validation failure issue summaries, and exhausted outcome", () => {
    const retryLog: AIRequestLog = {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      route: "/api/quiz",
      provider: "qwen",
      model: "qwen-plus",
      latencyMs: 3200,
      attempts: 3,
      retryCount: 2,
      validationFailures: ["ERR_FR_QUIZ_9_EXACT_ONE_TRUE", "ERR_FR_QUIZ_9_OVERLAP"],
      outcome: "validation_exhausted",
    };

    logAIRequest(retryLog);

    const captured = getCapturedLogs();
    expect(captured[0].attempts).toBe(3);
    expect(captured[0].retryCount).toBe(2);
    expect(captured[0].validationFailures).toEqual([
      "ERR_FR_QUIZ_9_EXACT_ONE_TRUE",
      "ERR_FR_QUIZ_9_OVERLAP",
    ]);
    expect(captured[0].outcome).toBe("validation_exhausted");
  });

  it("redacts sensitive provider keys and bearer tokens from strings", () => {
    const rawString = "Error calling OpenAI with sk-proj-1234567890abcdef1234567890 and Bearer eyJhbGciOi";
    const sanitized = redactSensitiveString(rawString);

    expect(sanitized).not.toContain("sk-proj-1234567890");
    expect(sanitized).toContain("[REDACTED_SECRET]");
  });

  it("deeply sanitizes log objects, eliminating forbidden fields per SRS §10", () => {
    const unsafeObject = {
      requestId: generateRequestId(),
      apiKey: "sk-12345678901234567890",
      authorization: "Bearer secret-token-123456",
      documentText: "Full unredacted sensitive textbook paragraph...",
      chunkText: "Private medical notes...",
      safeField: "safe concept title",
    };

    const sanitized = sanitizeLogObject(unsafeObject) as Record<string, unknown>;

    expect(sanitized.apiKey).toBe("[REDACTED_SENSITIVE]");
    expect(sanitized.authorization).toBe("[REDACTED_SENSITIVE]");
    expect(sanitized.documentText).toBe("[REDACTED_SENSITIVE]");
    expect(sanitized.chunkText).toBe("[REDACTED_SENSITIVE]");
    expect(sanitized.safeField).toBe("safe concept title");
  });
});
