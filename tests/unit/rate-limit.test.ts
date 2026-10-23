import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  enforceRateLimit,
  getClientIp,
  getRateLimitHeaders,
  resetRateLimits,
} from "@/lib/security/rate-limit";
import { RateLimitError } from "@/lib/errors";

describe("Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  function createRequest(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/test", {
      headers: new Headers(headers),
    });
  }

  it("extracts client IP from x-forwarded-for (first IP)", () => {
    const req = createRequest({ "x-forwarded-for": "203.0.113.195, 70.41.3.18" });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("extracts client IP from x-real-ip when x-forwarded-for is missing", () => {
    const req = createRequest({ "x-real-ip": "198.51.100.42" });
    expect(getClientIp(req)).toBe("198.51.100.42");
  });

  it("falls back to 127.0.0.1 when no IP headers exist", () => {
    const req = createRequest();
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("allows requests up to the limit and computes remaining correctly", () => {
    const req = createRequest({ "x-real-ip": "10.0.0.1" });
    const options = { keyPrefix: "test", limit: 3, windowMs: 60000 };
    const now = 1000000;

    const r1 = checkRateLimit(req, options, now);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(req, options, now + 1000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(req, options, now + 2000);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request exceeds limit
    const r4 = checkRateLimit(req, options, now + 3000);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("enforces rate limit by throwing RateLimitError when exceeded", () => {
    const req = createRequest({ "x-real-ip": "10.0.0.2" });
    const options = { keyPrefix: "test_enforce", limit: 2, windowMs: 60000 };
    const now = 1000000;

    enforceRateLimit(req, options, now);
    enforceRateLimit(req, options, now + 500);

    expect(() => enforceRateLimit(req, options, now + 1000)).toThrow(RateLimitError);
    try {
      enforceRateLimit(req, options, now + 1000);
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      const rlErr = err as RateLimitError;
      expect(rlErr.statusCode).toBe(429);
      expect(rlErr.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(rlErr.details).toHaveProperty("retryAfter");
    }
  });

  it("generates correct rate limit headers for allowed and blocked requests", () => {
    const allowedResult = {
      allowed: true,
      limit: 5,
      remaining: 4,
      resetTime: 1700000000000,
      retryAfterSeconds: 0,
    };
    const allowedHeaders = getRateLimitHeaders(allowedResult);
    expect(allowedHeaders["X-RateLimit-Limit"]).toBe("5");
    expect(allowedHeaders["X-RateLimit-Remaining"]).toBe("4");
    expect(allowedHeaders["Retry-After"]).toBeUndefined();

    const blockedResult = {
      allowed: false,
      limit: 5,
      remaining: 0,
      resetTime: 1700000060000,
      retryAfterSeconds: 60,
    };
    const blockedHeaders = getRateLimitHeaders(blockedResult);
    expect(blockedHeaders["X-RateLimit-Limit"]).toBe("5");
    expect(blockedHeaders["X-RateLimit-Remaining"]).toBe("0");
    expect(blockedHeaders["Retry-After"]).toBe("60");
  });

  it("slides the window and allows new requests after expiration", () => {
    const req = createRequest({ "x-real-ip": "10.0.0.3" });
    const options = { keyPrefix: "test_slide", limit: 1, windowMs: 10000 };
    const now = 1000000;

    const r1 = checkRateLimit(req, options, now);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit(req, options, now + 5000);
    expect(r2.allowed).toBe(false);

    // After 10s window passes
    const r3 = checkRateLimit(req, options, now + 11000);
    expect(r3.allowed).toBe(true);
  });
});
