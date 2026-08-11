import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  UnprocessableEntityError,
  RateLimitError,
  ProviderError,
  InsufficientEvidenceError,
  UnsupportedCapabilityError,
  ConfigurationError,
} from "@/lib/errors";

describe("Typed Error Hierarchy", () => {
  it("should construct ValidationError with status 400", () => {
    const err = new ValidationError("Invalid payload", { field: "email" });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Invalid payload");
    expect(err.details).toEqual({ field: "email" });
  });

  it("should construct NotFoundError with status 404", () => {
    const err = new NotFoundError("Document not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("should construct ConflictError with status 409", () => {
    const err = new ConflictError("Duplicate document");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("should construct PayloadTooLargeError with status 413", () => {
    const err = new PayloadTooLargeError("File exceeds 50MB");
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("should construct UnprocessableEntityError with status 422", () => {
    const err = new UnprocessableEntityError("Unparseable PDF");
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("UNPROCESSABLE_ENTITY");
  });

  it("should construct RateLimitError with status 429", () => {
    const err = new RateLimitError("Rate limit exceeded");
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("should construct ProviderError with status 502", () => {
    const err = new ProviderError("Upstream provider timeout");
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe("BAD_GATEWAY");
  });

  it("should construct InsufficientEvidenceError with status 422", () => {
    const err = new InsufficientEvidenceError();
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("should construct UnsupportedCapabilityError with status 500", () => {
    const err = new UnsupportedCapabilityError("Structured output not supported");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("UNSUPPORTED_CAPABILITY");
  });

  it("should construct ConfigurationError with status 500", () => {
    const err = new ConfigurationError("Missing API key");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("CONFIGURATION_ERROR");
  });
});
