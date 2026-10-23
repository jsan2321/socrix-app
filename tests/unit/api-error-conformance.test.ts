import { describe, it, expect } from "vitest";
import { z } from "zod";
import { formatErrorResponse } from "@/lib/api-response";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  UnprocessableEntityError,
  InsufficientEvidenceError,
  RateLimitError,
  ProviderError,
  UnsupportedCapabilityError,
} from "@/lib/errors";
import { ApiErrorResponseSchema } from "@/schemas/api";

describe("API Error Envelope Conformance (SRS §5.2 & §8, AC-16)", () => {
  async function verifyResponseEnvelope(response: Response, expectedStatus: number, expectedCode: string) {
    expect(response.status).toBe(expectedStatus);
    const json = await response.json();
    const parsed = ApiErrorResponseSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    expect(json.error.code).toBe(expectedCode);
    expect(typeof json.error.message).toBe("string");
    expect(json.error.message.length).toBeGreaterThan(0);
    return json;
  }

  it("conforms on ValidationError (400)", async () => {
    const err = new ValidationError("Invalid input parameter", { field: "title" });
    const res = formatErrorResponse(err);
    const json = await verifyResponseEnvelope(res, 400, "VALIDATION_ERROR");
    expect(json.error.details).toEqual({ field: "title" });
  });

  it("conforms on ZodError (400)", async () => {
    const schema = z.object({ count: z.number().int().min(1) });
    const parseRes = schema.safeParse({ count: -5 });
    if (!parseRes.success) {
      const res = formatErrorResponse(parseRes.error);
      const json = await verifyResponseEnvelope(res, 400, "VALIDATION_ERROR");
      expect(json.error.details).toBeDefined();
    }
  });

  it("conforms on NotFoundError (404)", async () => {
    const err = new NotFoundError("Document 123 not found");
    const res = formatErrorResponse(err);
    await verifyResponseEnvelope(res, 404, "NOT_FOUND");
  });

  it("conforms on ConflictError (409)", async () => {
    const err = new ConflictError("Document already exists", { documentId: "doc-uuid" });
    const res = formatErrorResponse(err);
    const json = await verifyResponseEnvelope(res, 409, "CONFLICT");
    expect(json.error.details).toEqual({ documentId: "doc-uuid" });
  });

  it("conforms on PayloadTooLargeError (413)", async () => {
    const err = new PayloadTooLargeError("File size exceeds 50MB");
    const res = formatErrorResponse(err);
    await verifyResponseEnvelope(res, 413, "PAYLOAD_TOO_LARGE");
  });

  it("conforms on UnprocessableEntityError (422) for scanned/encrypted/exhausted", async () => {
    const scannedErr = new UnprocessableEntityError("Document appears to be scanned", {
      failureReason: "likely_scanned",
    });
    const resScanned = formatErrorResponse(scannedErr);
    const jsonScanned = await verifyResponseEnvelope(resScanned, 422, "UNPROCESSABLE_ENTITY");
    expect(jsonScanned.error.details).toEqual({ failureReason: "likely_scanned" });

    const exhaustedErr = new UnprocessableEntityError("Document chunk pool exhausted", {
      reason: "document_exhausted",
    });
    const resExhausted = formatErrorResponse(exhaustedErr);
    await verifyResponseEnvelope(resExhausted, 422, "UNPROCESSABLE_ENTITY");
  });

  it("conforms on InsufficientEvidenceError (422)", async () => {
    const err = new InsufficientEvidenceError("No chunk met similarity threshold (>= 0.70)");
    const res = formatErrorResponse(err);
    await verifyResponseEnvelope(res, 422, "INSUFFICIENT_EVIDENCE");
  });

  it("conforms on RateLimitError (429)", async () => {
    const err = new RateLimitError("Rate limit exceeded", { retryAfter: 3600, limit: 5 });
    const res = formatErrorResponse(err);
    const json = await verifyResponseEnvelope(res, 429, "RATE_LIMIT_EXCEEDED");
    expect(json.error.details).toEqual({ retryAfter: 3600, limit: 5 });
  });

  it("conforms on ProviderError (502)", async () => {
    const err = new ProviderError("Upstream model service unavailable", { provider: "openai" });
    const res = formatErrorResponse(err);
    const json = await verifyResponseEnvelope(res, 502, "BAD_GATEWAY");
    expect(json.error.details).toEqual({ provider: "openai" });
  });

  it("conforms on UnsupportedCapabilityError (500)", async () => {
    const err = new UnsupportedCapabilityError("Streaming is not supported by provider");
    const res = formatErrorResponse(err);
    await verifyResponseEnvelope(res, 500, "UNSUPPORTED_CAPABILITY");
  });

  it("conforms on unexpected runtime Error (500) without leaking stack traces", async () => {
    const err = new Error("Unexpected Postgres connection reset");
    const res = formatErrorResponse(err, "Database query failed");
    const json = await verifyResponseEnvelope(res, 500, "INTERNAL_SERVER_ERROR");
    expect(json.error.message).toContain("Database query failed");
    expect(json.stack).toBeUndefined();
  });
});
