import { OpenAICompatibleProvider } from "@/lib/ai/providers/base-openai";
import { AIModelConfig } from "@/lib/ai/ai-provider";
import { config } from "@/lib/config";

export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly name = "deepseek";
  readonly config: AIModelConfig;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || config.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || "";
    super({
      apiKey: key,
      baseURL: "https://api.deepseek.com/v1",
    });

    this.config = {
      provider: "deepseek",
      model: model || config.AI_MODEL || "deepseek-chat",
      temperature: config.AI_TEMPERATURE,
      capabilities: {
        supportsNativeStructuredOutput: false,
        supportsStreaming: true,
        supportsToolCalling: true,
        maxContextTokens: 64536,
        maxOutputTokens: 8192,
        jsonReliability: "medium",
      },
    };
  }
}
