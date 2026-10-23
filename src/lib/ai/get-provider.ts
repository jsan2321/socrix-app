import { LLMProvider } from "@/lib/ai/ai-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { QwenProvider } from "@/lib/ai/providers/qwen";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";
import { FailoverLLMProvider } from "@/lib/ai/failover-provider";
import { config } from "@/lib/config";
import { ConfigurationError } from "@/lib/errors";

const providerRegistry: Record<string, () => LLMProvider> = {
  openai: () => new OpenAIProvider(),
  qwen: () => new QwenProvider(),
  deepseek: () => new DeepSeekProvider(),
};

/**
 * Builds an ordered chain of available providers for failover resilience.
 */
export function buildFailoverChain(primaryName: string): LLMProvider[] {
  const chainNames = [primaryName.toLowerCase()];
  const candidates = ["openai", "qwen", "deepseek"];

  for (const c of candidates) {
    if (!chainNames.includes(c)) {
      const hasKey =
        (c === "openai" && (config.OPENAI_API_KEY || process.env.OPENAI_API_KEY)) ||
        (c === "qwen" && (config.QWEN_API_KEY || process.env.QWEN_API_KEY)) ||
        (c === "deepseek" && (config.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY));

      if (hasKey) {
        chainNames.push(c);
      }
    }
  }

  return chainNames
    .map((name) => {
      const factory = providerRegistry[name];
      return factory ? factory() : null;
    })
    .filter((p): p is LLMProvider => p !== null);
}

export interface GetProviderOptions {
  failover?: boolean;
}

/**
 * Factory function to retrieve the configured or requested LLMProvider instance.
 * Automatically wraps in FailoverLLMProvider when multiple providers are configured.
 */
export function getProvider(
  overrideProvider?: string,
  options?: GetProviderOptions
): LLMProvider {
  const providerName = (
    overrideProvider ||
    config.AI_PROVIDER ||
    process.env.AI_PROVIDER ||
    "openai"
  ).toLowerCase();

  const factory = providerRegistry[providerName];
  if (!factory) {
    throw new ConfigurationError(
      `Unsupported AI provider: '${providerName}'. Supported providers are: ${Object.keys(
        providerRegistry
      ).join(", ")}`
    );
  }

  // When overrideProvider is explicitly passed (e.g. in unit tests), return direct provider unless failover requested
  const shouldFailover = options?.failover ?? (overrideProvider === undefined);
  if (shouldFailover) {
    const chain = buildFailoverChain(providerName);
    if (chain.length > 1) {
      return new FailoverLLMProvider(chain);
    }
  }

  return factory();
}

/**
 * Registers a custom provider factory instance into the registry.
 */
export function registerProvider(name: string, factory: () => LLMProvider): void {
  providerRegistry[name.toLowerCase()] = factory;
}
