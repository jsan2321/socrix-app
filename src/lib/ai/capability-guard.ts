import { LLMProvider, ProviderCapabilities } from "@/lib/ai/ai-provider";
import { UnsupportedCapabilityError } from "@/lib/errors";

/**
 * Asserts that an LLMProvider satisfies specified capability requirements.
 * Throws UnsupportedCapabilityError if a required capability is missing.
 */
export function assertProviderCapabilities(
  provider: LLMProvider,
  requiredCapabilities: Partial<ProviderCapabilities>
): void {
  const caps = provider.config.capabilities;

  for (const [key, expectedValue] of Object.entries(requiredCapabilities)) {
    const capKey = key as keyof ProviderCapabilities;
    const actualValue = caps[capKey];

    if (typeof expectedValue === "boolean" && expectedValue && !actualValue) {
      throw new UnsupportedCapabilityError(
        `Provider '${provider.name}' does not support required capability '${capKey}'`,
        { provider: provider.name, required: capKey }
      );
    }
  }
}
