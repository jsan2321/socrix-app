import {
  LLMProvider,
  StructuredGenerationRequest,
  StructuredGenerationResult,
} from "@/lib/ai/ai-provider";

/**
 * Strategy execution wrapper for structured output generation.
 * Strategy branches on `provider.config.capabilities.supportsNativeStructuredOutput`.
 */
export async function withStructuredOutput<T>(
  provider: LLMProvider,
  request: StructuredGenerationRequest<T>
): Promise<StructuredGenerationResult<T>> {
  const isNative = provider.config.capabilities.supportsNativeStructuredOutput;
  const strategy = isNative ? "native" : "constrained-json";

  // Both strategies funnel through provider.generateStructured with uniform Zod validation & retry guarantee
  return provider.generateStructured({
    ...request,
    systemPrompt:
      strategy === "constrained-json"
        ? `${request.systemPrompt}\n\n[Strategy: Constrained JSON Mode]`
        : request.systemPrompt,
  });
}
