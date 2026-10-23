import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchQuizQuestion } from "@/lib/quiz/stream";

const requestId = "550e8400-e29b-41d4-a716-446655440199";
const question = { questionId: "q-1", concept: "Transport", difficulty: "foundational", mode: "identify_truth", statements: [{ statementId: "s-1", text: "Claim" }] };
const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

describe("quiz stream client", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("reads real status events and the final validated question", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(event("status", { status: "validating" }) + event("question", question), { headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const statuses: string[] = [];
    const result = await fetchQuizQuestion("session", [], requestId, (status) => statuses.push(status));
    expect(statuses).toEqual(["validating"]);
    expect(result).toEqual(question);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to JSON using the same request ID after a truncated stream", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(event("status", { status: "generating" }), { headers: { "content-type": "text/event-stream" } }))
      .mockResolvedValueOnce(Response.json(question));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchQuizQuestion("session", [], requestId, () => {});
    expect(result).toEqual(question);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).requestId).toBe(requestId);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).requestId).toBe(requestId);
  });

  it("does not retry a terminal server error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(event("error", { error: { code: "BAD_GATEWAY", message: "Validation exhausted" } }), { headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchQuizQuestion("session", [], requestId, () => {})).rejects.toThrow("Validation exhausted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
