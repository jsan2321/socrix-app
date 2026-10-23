import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { FailoverLLMProvider } from "@/lib/ai/failover-provider";
import { getProvider } from "@/lib/ai/get-provider";
import type { LLMProvider, StructuredGenerationRequest } from "@/lib/ai/ai-provider";

vi.mock("openai", () => ({
  default: class MockOpenAI {
    models = { list: vi.fn().mockResolvedValue({ data: [] }) };
    chat = { completions: { create: vi.fn() } };
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    AI_PROVIDER: "openai",
    AI_MODEL: "gpt-4o-mini",
    AI_TEMPERATURE: 0.7,
    OPENAI_API_KEY: "mock-openai-key",
    QWEN_API_KEY: "mock-qwen-key",
    DEEPSEEK_API_KEY: "mock-deepseek-key",
  },
}));

const DummySchema = z.object({
  greeting: z.string(),
});

function createMockProvider(name: string, fail: boolean = false): LLMProvider {
  return {
    name,
    config: {
      provider: name,
      model: `${name}-model`,
      temperature: 0.7,
      capabilities: {
        supportsNativeStructuredOutput: true,
        supportsStreaming: true,
        supportsToolCalling: false,
        maxContextTokens: 4096,
        maxOutputTokens: 1024,
        jsonReliability: "high",
      },
    },
    generateStructured: vi.fn().mockImplementation(async () => {
      if (fail) {
        throw new Error(`${name} simulated 429 Rate Limit exceeded`);
      }
      return {
        data: { greeting: `Hello from ${name}` },
        raw: { greeting: `Hello from ${name}` },
        attempts: 1,
        provider: name,
        model: `${name}-model`,
      };
    }),
    streamText: vi.fn().mockImplementation(async function* () {
      if (fail) {
        throw new Error(`${name} stream unavailable (503)`);
      }
      yield `Chunk from ${name}`;
    }),
    healthCheck: vi.fn().mockResolvedValue({ ok: !fail }),
  };
}

describe("Silent AI Provider Failover & Circuit Breaker", () => {
  it("uses primary provider without failover when primary succeeds", async () => {
    const primary = createMockProvider("primary", false);
    const secondary = createMockProvider("secondary", false);

    const failover = new FailoverLLMProvider([primary, secondary]);
    const request: StructuredGenerationRequest<z.infer<typeof DummySchema>> = {
      systemPrompt: "sys",
      userPrompt: "usr",
      schema: DummySchema,
      schemaName: "DummySchema",
    };

    const result = await failover.generateStructured(request);
    expect(result.provider).toBe("primary");
    expect(result.data.greeting).toBe("Hello from primary");
    expect(primary.generateStructured).toHaveBeenCalledTimes(1);
    expect(secondary.generateStructured).not.toHaveBeenCalled();
  });

  it("silently fails over to secondary provider when primary throws an error", async () => {
    const primary = createMockProvider("primary", true); // Fails with 429
    const secondary = createMockProvider("secondary", false); // Succeeds

    const failover = new FailoverLLMProvider([primary, secondary]);
    const request: StructuredGenerationRequest<z.infer<typeof DummySchema>> = {
      systemPrompt: "sys",
      userPrompt: "usr",
      schema: DummySchema,
      schemaName: "DummySchema",
    };

    const result = await failover.generateStructured(request);
    expect(result.provider).toBe("secondary");
    expect(result.data.greeting).toBe("Hello from secondary");
    expect(primary.generateStructured).toHaveBeenCalledTimes(1);
    expect(secondary.generateStructured).toHaveBeenCalledTimes(1);
  });

  it("throws ProviderError when all providers in the failover chain fail", async () => {
    const primary = createMockProvider("primary", true);
    const secondary = createMockProvider("secondary", true);

    const failover = new FailoverLLMProvider([primary, secondary]);
    const request: StructuredGenerationRequest<z.infer<typeof DummySchema>> = {
      systemPrompt: "sys",
      userPrompt: "usr",
      schema: DummySchema,
      schemaName: "DummySchema",
    };

    await expect(failover.generateStructured(request)).rejects.toThrow(
      /All AI providers in failover chain failed/
    );
  });

  it("fails over streaming text generation when primary stream creation fails", async () => {
    const primary = createMockProvider("primary", true);
    const secondary = createMockProvider("secondary", false);

    const failover = new FailoverLLMProvider([primary, secondary]);
    const chunks: string[] = [];

    for await (const chunk of failover.streamText({ systemPrompt: "sys", userPrompt: "usr" })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Chunk from secondary"]);
    expect(secondary.streamText).toHaveBeenCalledTimes(1);
  });

  it("returns healthy if at least one provider in chain is healthy", async () => {
    const primary = createMockProvider("primary", true);
    const secondary = createMockProvider("secondary", false);

    const failover = new FailoverLLMProvider([primary, secondary]);
    const health = await failover.healthCheck();
    expect(health.ok).toBe(true);
  });

  it("resolves direct provider when override is passed", () => {
    const provider = getProvider("openai");
    expect(provider.name).toBe("openai");
  });

  it("resolves FailoverLLMProvider when failover option is enabled", () => {
    const provider = getProvider("openai", { failover: true });
    expect(provider).toBeInstanceOf(FailoverLLMProvider);
  });
});
