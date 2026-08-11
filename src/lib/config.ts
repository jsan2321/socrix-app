import { z } from "zod";
import { ConfigurationError } from "@/lib/errors";

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_ANON_KEY: z.string().optional(),
  
  AI_PROVIDER: z.enum(["openai", "qwen", "deepseek"]).default("openai"),
  AI_MODEL: z.string().min(1, "AI_MODEL is required"),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  
  OPENAI_API_KEY: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  
  AI_FALLBACK_PROVIDER: z.string().optional(),
  AI_FALLBACK_MODEL: z.string().optional(),
  
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(50),
  MAX_INGESTION_SECONDS: z.coerce.number().positive().default(50),
  
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL_ENV: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const issueMessages = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    ).join("; ");
    throw new ConfigurationError(`Environment configuration error: ${issueMessages}`);
  }

  const config = result.data;

  // Validate active provider API key presence
  if (config.AI_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
    throw new ConfigurationError("OPENAI_API_KEY is required when AI_PROVIDER is 'openai'");
  }
  if (config.AI_PROVIDER === "qwen" && !config.QWEN_API_KEY) {
    throw new ConfigurationError("QWEN_API_KEY is required when AI_PROVIDER is 'qwen'");
  }
  if (config.AI_PROVIDER === "deepseek" && !config.DEEPSEEK_API_KEY) {
    throw new ConfigurationError("DEEPSEEK_API_KEY is required when AI_PROVIDER is 'deepseek'");
  }

  return config;
}

export const config = loadConfig();
