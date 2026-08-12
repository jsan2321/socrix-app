import { OpenAICompatibleProvider } from "@/lib/ai/providers/base-openai";
import { AIModelConfig } from "@/lib/ai/ai-provider";
import { config } from "@/lib/config";

export class QwenProvider extends OpenAICompatibleProvider {
  readonly name = "qwen";
  readonly config: AIModelConfig;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || config.QWEN_API_KEY || process.env.QWEN_API_KEY || "";
    super({
      apiKey: key,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    this.config = {
      provider: "qwen",
      model: model || config.AI_MODEL || "qwen-max",
      temperature: config.AI_TEMPERATURE,
      capabilities: {
        supportsNativeStructuredOutput: false,
        supportsStreaming: true,
        supportsToolCalling: true,
        maxContextTokens: 32768,
        maxOutputTokens: 8192,
        jsonReliability: "medium",
      },
    };
  }
}
