import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/quiz/route";
import { resetRateLimits } from "@/lib/security/rate-limit";
import { ProviderError } from "@/lib/errors";

const generateQuizMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/quiz/generation", () => ({
  generateDevilsAdvocateQuiz: generateQuizMock,
}));

describe("Quiz API response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it("returns the persisted session mode to the quiz client", async () => {
    generateQuizMock.mockResolvedValue({
      mode: "identify_both_lies",
      question: {
        id: "550e8400-e29b-41d4-a716-446655440101",
        concept: "Membrane Transport",
        difficulty: "intermediate",
      },
      statements: [
        { id: "550e8400-e29b-41d4-a716-446655440102", text: "Truth", display_order: 0 },
        { id: "550e8400-e29b-41d4-a716-446655440103", text: "Lie one", display_order: 1 },
        { id: "550e8400-e29b-41d4-a716-446655440104", text: "Lie two", display_order: 2 },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "550e8400-e29b-41d4-a716-446655440100",
          excludeChunkIds: [],
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.mode).toBe("identify_both_lies");
    expect(body.statements).toHaveLength(3);
    expect(body.statements[0]).not.toHaveProperty("isTrue");
    expect(body).toHaveProperty("groundingChunkIds");
  });

  it("streams only statuses and a sanitized persisted question", async () => {
    generateQuizMock.mockImplementation(async ({ onProgress }) => {
      onProgress("selecting");
      onProgress("validating");
      return {
        mode: "identify_truth",
        question: { id: "q-1", concept: "Transport", difficulty: "foundational", grounding_chunk_ids: [] },
        statements: [{ id: "s-1", text: "A grounded claim", display_order: 0, is_true: true, grounding_rationale: "Secret" }],
      };
    });
    const requestId = "550e8400-e29b-41d4-a716-446655440199";
    const response = await POST(new Request("http://localhost/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ sessionId: "550e8400-e29b-41d4-a716-446655440100", requestId }),
    }));
    const body = await response.text();
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: status");
    expect(body).toContain("event: question");
    expect(body).toContain("event: done");
    expect(body).not.toContain("is_true");
    expect(body).not.toContain("grounding_rationale");
    expect(generateQuizMock).toHaveBeenCalledWith(expect.objectContaining({ requestId }));
  });

  it("does not release a question when validation fails", async () => {
    generateQuizMock.mockRejectedValue(new ProviderError("Validation exhausted"));
    const response = await POST(new Request("http://localhost/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ sessionId: "550e8400-e29b-41d4-a716-446655440100", requestId: "550e8400-e29b-41d4-a716-446655440199" }),
    }));
    const body = await response.text();
    expect(body).toContain("event: error");
    expect(body).not.toContain("event: question");
  });
});
