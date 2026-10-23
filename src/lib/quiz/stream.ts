export interface ClientQuizQuestion {
  questionId: string;
  concept: string;
  difficulty: "foundational" | "intermediate" | "advanced";
  mode: "identify_truth" | "identify_both_lies";
  questionTarget?: number | null;
  groundingChunkIds?: string[];
  statements: Array<{ statementId: string; text: string; displayOrder?: number }>;
}

export type QuizProgressStatus = "selecting" | "generating" | "validating" | "persisting";

export class QuizStreamError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly code?: string) { super(message); }
}

async function readError(response: Response): Promise<{ message: string; code?: string }> {
  try {
    const body = await response.json();
    return { message: body.error?.message || "Failed to generate quiz question.", code: body.error?.code };
  } catch {
    return { message: "Failed to generate quiz question." };
  }
}

export async function fetchQuizQuestion(
  sessionId: string,
  excludeChunkIds: string[],
  requestId: string,
  onProgress: (status: QuizProgressStatus) => void,
): Promise<ClientQuizQuestion> {
  const payload = JSON.stringify({ sessionId, excludeChunkIds, requestId });
  const request = async (streaming: boolean) => fetch("/api/quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(streaming ? { Accept: "text/event-stream" } : {}) },
    body: payload,
  });

  let response: Response;
  try {
    response = await request(true);
    if (!response.ok) {
      const error = await readError(response);
      throw new QuizStreamError(error.message, false, error.code);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream")) return await response.json();
    if (!response.body) throw new QuizStreamError("Stream unavailable", true);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let question: ClientQuizQuestion | null = null;
    while (true) {
      const { done, value } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = block.match(/^event: (.+)$/m)?.[1];
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (data) {
          const parsed = JSON.parse(data);
          if (event === "status") onProgress(parsed.status);
          if (event === "question") question = parsed as ClientQuizQuestion;
          if (event === "error") throw new QuizStreamError(parsed.error?.message || "Failed to generate quiz question.", false, parsed.error?.code);
        }
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (question) return question;
    throw new QuizStreamError("The question stream ended before a question was ready.", true);
  } catch (error) {
    if (error instanceof QuizStreamError && !error.retryable) throw error;
    response = await request(false);
    if (!response.ok) {
      const fallbackError = await readError(response);
      throw new QuizStreamError(fallbackError.message, false, fallbackError.code);
    }
    return await response.json();
  }
}
