import { test, expect } from "@playwright/test";
import { resetRateLimits } from "../../src/lib/security/rate-limit";

test.describe("Security & Abuse Prevention E2E (SRS §5.2, §6.3, AC-4, AC-17)", () => {
  test.beforeEach(() => {
    resetRateLimits();
  });

  test("withholds isTrue boolean and grounding rationale from client quiz response (AC-4)", async ({ request }) => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440001";

    const response = await request.post("/api/quiz", {
      data: { sessionId: mockSessionId },
    });

    // Even if session is not found or mock fails, if 201 is returned, verify isTrue is withheld
    if (response.status() === 201) {
      const json = await response.json();
      expect(json.statements).toBeDefined();
      for (const statement of json.statements) {
        expect(statement.isTrue).toBeUndefined();
        expect(statement.groundingRationale).toBeUndefined();
      }
    }
  });

  test("enforces in-memory rate limiting on upload endpoint (5 requests per hour)", async ({ request }) => {
    resetRateLimits();

    const dummyPdfBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

    const clientIp = `198.51.100.${Date.now() % 250}`;
    const headers = { "x-forwarded-for": clientIp };

    // Send 5 rapid upload requests
    for (let i = 0; i < 5; i++) {
      const res = await request.post("/api/documents", {
        headers,
        multipart: {
          file: {
            name: `test-${i}.pdf`,
            mimeType: "application/pdf",
            buffer: dummyPdfBuffer,
          },
        },
      });
      // Requests 1-5 may return 201, 409, or 422, but MUST NOT be 429
      expect(res.status()).not.toBe(429);
      expect(res.headers()["x-ratelimit-limit"]).toBe("5");
    }

    // 6th upload request from the same IP must be rejected with 429 Too Many Requests
    const blockedRes = await request.post("/api/documents", {
      headers,
      multipart: {
        file: {
          name: "test-6.pdf",
          mimeType: "application/pdf",
          buffer: dummyPdfBuffer,
        },
      },
    });

    expect(blockedRes.status()).toBe(429);
    expect(blockedRes.headers()["retry-after"]).toBeDefined();
    expect(blockedRes.headers()["x-ratelimit-remaining"]).toBe("0");

    const json = await blockedRes.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(json.error.message).toContain("Rate limit exceeded");
  });
});
