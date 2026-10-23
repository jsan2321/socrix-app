import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { getProvider, registerProvider } from "@/lib/ai/get-provider";
import type { LLMProvider } from "@/lib/ai/ai-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { QwenProvider } from "@/lib/ai/providers/qwen";
import { DeepSeekProvider } from "@/lib/ai/providers/deepseek";
import { withStructuredOutput } from "@/lib/ai/structured-output";
import { assertProviderCapabilities } from "@/lib/ai/capability-guard";
import { ConfigurationError, UnsupportedCapabilityError } from "@/lib/errors";

vi.mock("@/lib/config", () => ({
  config: {
    AI_PROVIDER: "openai",
    AI_MODEL: "gpt-4o-mini",
    AI_TEMPERATURE: 0.7,
    OPENAI_API_KEY: "test-openai-key",
    QWEN_API_KEY: "test-qwen-key",
    DEEPSEEK_API_KEY: "test-deepseek-key",
  },
}));

const mockModelsList = vi.fn().mockResolvedValue({ data: [] });
const mockChatCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      models = {
        list: mockModelsList,
      };
      chat = {
        completions: {
          create: mockChatCreate,
        },
      };
    },
  };
});

describe("AI Provider Abstraction Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModelsList.mockResolvedValue({ data: [] });
  });

  describe("Provider Factory Registry", () => {
    it("resolves OpenAIProvider when provider name is 'openai'", () => {
      const provider = getProvider("openai");
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.name).toBe("openai");
      expect(provider.config.capabilities.supportsNativeStructuredOutput).toBe(true);
    });

    it("resolves QwenProvider when provider name is 'qwen'", () => {
      const provider = getProvider("qwen");
      expect(provider).toBeInstanceOf(QwenProvider);
      expect(provider.name).toBe("qwen");
      expect(provider.config.capabilities.supportsNativeStructuredOutput).toBe(false);
    });

    it("resolves DeepSeekProvider when provider name is 'deepseek'", () => {
      const provider = getProvider("deepseek");
      expect(provider).toBeInstanceOf(DeepSeekProvider);
      expect(provider.name).toBe("deepseek");
      expect(provider.config.capabilities.supportsNativeStructuredOutput).toBe(false);
    });

    it("throws ConfigurationError for unsupported provider", () => {
      expect(() => getProvider("unsupported-llm")).toThrow(ConfigurationError);
    });

    it("allows registering custom provider factory", () => {
      const mockProvider = {
        name: "custom",
        config: { capabilities: {} },
      } as unknown as LLMProvider;
      registerProvider("custom", () => mockProvider);
      expect(getProvider("custom")).toBe(mockProvider);
    });
  });

  describe("Capability Guard", () => {
    it("passes when provider has required capabilities", () => {
      const provider = getProvider("openai");
      expect(() =>
        assertProviderCapabilities(provider, { supportsNativeStructuredOutput: true })
      ).not.toThrow();
    });

    it("throws UnsupportedCapabilityError when capability is missing", () => {
      const provider = getProvider("qwen");
      expect(() =>
        assertProviderCapabilities(provider, { supportsNativeStructuredOutput: true })
      ).toThrow(UnsupportedCapabilityError);
    });

    it("throws UnsupportedCapabilityError when streaming capability is required but missing", () => {
      const customProvider = {
        name: "nostream",
        config: { capabilities: { supportsStreaming: false } },
      } as unknown as LLMProvider;

      expect(() =>
        assertProviderCapabilities(customProvider, { supportsStreaming: true })
      ).toThrow(UnsupportedCapabilityError);
    });
  });

  describe("Structured Output Strategy Execution", () => {
    const TestSchema = z.object({
      greeting: z.string(),
      score: z.number(),
    });

    it("executes native structured generation for providers with native capability", async () => {
      const provider = getProvider("openai");

      const spy = vi.spyOn(provider, "generateStructured").mockResolvedValueOnce({
        data: { greeting: "Hello Socratic", score: 100 },
        raw: { greeting: "Hello Socratic", score: 100 },
        attempts: 1,
        provider: "openai",
        model: "gpt-4o-mini",
      });

      const result = await withStructuredOutput(provider, {
        systemPrompt: "You are a test assistant.",
        userPrompt: "Generate a greeting.",
        schema: TestSchema,
        schemaName: "TestSchema",
      });

      expect(result.data.greeting).toBe("Hello Socratic");
      expect(result.data.score).toBe(100);
      expect(result.attempts).toBe(1);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: "You are a test assistant.",
        })
      );
    });

    it("appends constrained JSON directive for providers lacking native structured output", async () => {
      const provider = getProvider("qwen");

      const spy = vi.spyOn(provider, "generateStructured").mockResolvedValueOnce({
        data: { greeting: "Hello Qwen", score: 95 },
        raw: { greeting: "Hello Qwen", score: 95 },
        attempts: 1,
        provider: "qwen",
        model: "qwen-plus",
      });

      const result = await withStructuredOutput(provider, {
        systemPrompt: "Base prompt.",
        userPrompt: "Input text.",
        schema: TestSchema,
        schemaName: "TestSchema",
      });

      expect(result.data.greeting).toBe("Hello Qwen");
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining("[Strategy: Constrained JSON Mode]"),
        })
      );
    });
  });

  describe("Health Check", () => {
    it("returns ok: true and latencyMs on successful model listing", async () => {
      const provider = getProvider("openai");
      const health = await provider.healthCheck();
      expect(health.ok).toBe(true);
      expect(typeof health.latencyMs).toBe("number");
    });

    it("returns ok: false and error message when model listing fails", async () => {
      mockModelsList.mockRejectedValueOnce(new Error("Network connection refused"));
      const provider = getProvider("openai");
      const health = await provider.healthCheck();
      expect(health.ok).toBe(false);
      expect(health.error).toContain("Network connection refused");
      expect(typeof health.latencyMs).toBe("number");
    });
  });
});
