import { LLMProvider } from "@/lib/ai/ai-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { QwenProvider } from "@/lib/ai/providers/qwen";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";
import { config } from "@/lib/config";
import { ConfigurationError } from "@/lib/errors";

const providerRegistry: Record<string, () => LLMProvider> = {
  openai: () => new OpenAIProvider(),
  qwen: () => new QwenProvider(),
  deepseek: () => new DeepSeekProvider(),
};

/**
 * Factory function to retrieve the configured or requested LLMProvider instance.
 */
export function getProvider(overrideProvider?: string): LLMProvider {
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

  return factory();
}

/**
 * Registers a custom provider factory instance into the registry.
 */
export function registerProvider(name: string, factory: () => LLMProvider): void {
  providerRegistry[name.toLowerCase()] = factory;
}
