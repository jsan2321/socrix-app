import OpenAI from "openai";
import {
  LLMProvider,
  AIModelConfig,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
} from "@/lib/ai/ai-provider";
import { ProviderError } from "@/lib/errors";

export abstract class OpenAICompatibleProvider implements LLMProvider {
  abstract readonly name: string;
  abstract readonly config: AIModelConfig;
  protected client: OpenAI;

  constructor(options: { apiKey: string; baseURL?: string }) {
    if (!options.apiKey) {
      throw new ProviderError("API key is missing for AI provider", {
        provider: this.constructor.name,
      });
    }
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
  }

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    const maxRetries =
      request.maxRetries ??
      (this.config.capabilities.jsonReliability === "high" ? 2 : 3);

    let lastError: Error | null = null;
    let attempts = 0;

    const systemPromptWithJsonRule = `${request.systemPrompt}\n\nIMPORTANT: You MUST respond ONLY with valid, raw JSON matching the required schema. Do not include markdown code blocks (\`\`\`json), commentary, or extra text.`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      attempts = attempt;
      try {
        const completion = await this.client.chat.completions.create({
          model: this.config.model,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          messages: [
            { role: "system", content: systemPromptWithJsonRule },
            { role: "user", content: request.userPrompt },
          ],
          response_format: this.config.capabilities.supportsNativeStructuredOutput
            ? { type: "json_object" }
            : undefined,
        });

        const rawContent = completion.choices[0]?.message?.content ?? "";
        const cleanContent = rawContent.replace(/^```json\s*/, "").replace(/```$/, "").trim();

        const json = JSON.parse(cleanContent);
        const parsedData = request.schema.parse(json);

        return {
          data: parsedData,
          raw: json,
          attempts,
          provider: this.name,
          model: this.config.model,
          usage: completion.usage
            ? {
                inputTokens: completion.usage.prompt_tokens,
                outputTokens: completion.usage.completion_tokens,
              }
            : undefined,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          const delayMs = 500 * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, delayMs));
        }
      }
    }

    throw new ProviderError(
      `Structured generation failed after ${attempts} attempts: ${
        lastError?.message ?? "Validation failed"
      }`,
      { provider: this.name, model: this.config.model, attempts, lastError: lastError?.message }
    );
  }

  async *streamText(request: TextGenerationRequest): AsyncIterable<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.config.model,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        stream: true,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (err: unknown) {
      throw new ProviderError(
        `Streaming failed: ${err instanceof Error ? err.message : String(err)}`,
        { provider: this.name, error: err }
      );
    }
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    try {
      await this.client.models.list();
      const latencyMs = Date.now() - startTime;
      return { ok: true, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { ok: false, latencyMs, error: errorMsg };
    }
  }
}
