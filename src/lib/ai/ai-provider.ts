import { z } from "zod";

export interface ProviderCapabilities {
  supportsNativeStructuredOutput: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
  jsonReliability: "high" | "medium" | "low";
}

export interface AIModelConfig {
  provider: "openai" | "qwen" | "deepseek" | (string & {});
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  capabilities: ProviderCapabilities;
}

export interface StructuredGenerationRequest<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxRetries?: number;
  temperature?: number;
}

export interface TextGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface StructuredGenerationResult<T> {
  data: T;
  raw: unknown;
  attempts: number;
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  readonly config: AIModelConfig;

  generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>>;

  streamText(
    request: TextGenerationRequest
  ): AsyncIterable<string>;

  healthCheck(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}
