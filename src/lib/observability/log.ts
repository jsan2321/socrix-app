import { z } from "zod";

/**
 * AI request log schema.
 */
export const AIRequestLogSchema = z.object({
  requestId: z.string().uuid("requestId must be a valid UUID"),
  timestamp: z.string().datetime("timestamp must be ISO 8601"),
  route: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  attempts: z.number().int().min(1),
  tokenUsage: z
    .object({
      input: z.number().int().nonnegative(),
      output: z.number().int().nonnegative(),
    })
    .optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
  retrievalSimilarity: z.number().min(0).max(1).optional(),
  validationFailures: z.array(z.string()).optional(),
  retryCount: z.number().int().nonnegative(),
  outcome: z.enum(["success", "provider_error", "validation_exhausted", "timeout"]),
});

export type AIRequestLog = z.infer<typeof AIRequestLogSchema>;

// Patterns for credential and secret redaction
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9_\-]{15,}/gi,
  /bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi,
  /sbp_[a-zA-Z0-9]{20,}/gi,
  /(?:api[_-]?key|password|secret|authorization)\s*[:=]\s*["']?([^"',\s]+)/gi,
];

// In-memory capture log buffer for testing and verification
const capturedLogs: AIRequestLog[] = [];

/**
 * Redact secrets and sensitive substrings from strings
 */
export function redactSensitiveString(str: string): string {
  let sanitized = str;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED_SECRET]");
  }
  return sanitized;
}

/**
 * Deep redaction of objects to eliminate keys, secrets, or raw text payloads
 */
export function sanitizeLogObject<T>(obj: T): T {
  if (typeof obj === "string") {
    return redactSensitiveString(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogObject(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // Block restricted fields from structured logs.
      if (
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("auth") ||
        (lowerKey.includes("token") && !lowerKey.includes("tokenusage") && !lowerKey.includes("tokencount")) ||
        lowerKey.includes("password") ||
        lowerKey.includes("raw") ||
        lowerKey.includes("binary") ||
        lowerKey.includes("chunktext") ||
        lowerKey.includes("documenttext")
      ) {
        sanitizedObj[key] = "[REDACTED_SENSITIVE]";
      } else {
        sanitizedObj[key] = sanitizeLogObject(value);
      }
    }
    return sanitizedObj as T;
  }
  return obj;
}

/**
 * Primary structured logging function for AI operations.
 */
export function logAIRequest(log: AIRequestLog): AIRequestLog {
  const sanitized = sanitizeLogObject(log);
  // Validate schema
  const parsed = AIRequestLogSchema.parse(sanitized);

  // Store in memory buffer for test assertion
  capturedLogs.push(parsed);

  // Write structured JSON to stdout for serverless log aggregation (Vercel / Datadog)
  console.log(JSON.stringify(parsed));

  return parsed;
}

/**
 * Generate a new operation correlation request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Retrieve captured logs (for testing)
 */
export function getCapturedLogs(): readonly AIRequestLog[] {
  return capturedLogs;
}

/**
 * Clear captured logs (for test isolation)
 */
export function clearCapturedLogs(): void {
  capturedLogs.length = 0;
}
