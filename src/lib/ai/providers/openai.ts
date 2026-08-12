import { OpenAICompatibleProvider } from "@/lib/ai/providers/base-openai";
import { AIModelConfig } from "@/lib/ai/ai-provider";
import { config } from "@/lib/config";

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly name = "openai";
  readonly config: AIModelConfig;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || config.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";
    super({ apiKey: key });

    this.config = {
      provider: "openai",
      model: model || config.AI_MODEL || "gpt-4o-mini",
      temperature: config.AI_TEMPERATURE,
      capabilities: {
        supportsNativeStructuredOutput: true,
        supportsStreaming: true,
        supportsToolCalling: true,
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
        jsonReliability: "high",
      },
    };
  }
}
