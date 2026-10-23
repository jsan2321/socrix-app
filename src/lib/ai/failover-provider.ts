import {
  LLMProvider,
  AIModelConfig,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
} from "@/lib/ai/ai-provider";
import { ProviderError } from "@/lib/errors";

export interface FailoverEvent {
  fromProvider: string;
  toProvider: string;
  error: string;
  timestamp: string;
}

export class FailoverLLMProvider implements LLMProvider {
  readonly providers: LLMProvider[];

  constructor(providers: LLMProvider[]) {
    if (!providers || providers.length === 0) {
      throw new ProviderError("FailoverLLMProvider requires at least one provider instance");
    }
    this.providers = providers;
  }

  get name(): string {
    return this.providers[0]?.name ?? "failover";
  }

  get config(): AIModelConfig {
    return this.providers[0].config;
  }

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    const errors: { provider: string; message: string }[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const currentProvider = this.providers[i];
      try {
        const result = await currentProvider.generateStructured(request);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ provider: currentProvider.name, message: msg });

        const nextProvider = this.providers[i + 1];
        if (nextProvider) {
          // Silent automatic failover
          console.warn(
            `[AI Failover] Provider '${currentProvider.name}' failed (${msg}). Seamlessly failing over to '${nextProvider.name}'...`
          );
        }
      }
    }

    // If all providers in the chain fail
    const errorSummaries = errors.map((e) => `[${e.provider}: ${e.message}]`).join("; ");
    throw new ProviderError(
      `All AI providers in failover chain failed: ${errorSummaries}`,
      {
        provider: this.name,
        chain: this.providers.map((p) => p.name),
        errors,
      }
    );
  }

  async *streamText(request: TextGenerationRequest): AsyncIterable<string> {
    const errors: { provider: string; message: string }[] = [];

    for (let i = 0; i < this.providers.length; i++) {
      const currentProvider = this.providers[i];
      try {
        for await (const chunk of currentProvider.streamText(request)) {
          yield chunk;
        }
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ provider: currentProvider.name, message: msg });

        const nextProvider = this.providers[i + 1];
        if (nextProvider) {
          console.warn(
            `[AI Failover] Stream provider '${currentProvider.name}' failed (${msg}). Seamlessly failing over to '${nextProvider.name}'...`
          );
        }
      }
    }

    const errorSummaries = errors.map((e) => `[${e.provider}: ${e.message}]`).join("; ");
    throw new ProviderError(
      `All AI stream providers in failover chain failed: ${errorSummaries}`,
      { provider: this.name, errors }
    );
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    for (const provider of this.providers) {
      const health = await provider.healthCheck();
      if (health.ok) {
        return health;
      }
    }
    return { ok: false, error: "All providers in failover chain failed health check" };
  }
}
