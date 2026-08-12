// Set environment variables for testing before loading config
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.AI_PROVIDER = "openai";
process.env.AI_MODEL = "gpt-4o";
process.env.OPENAI_API_KEY = "sk-test-key";
process.env.EMBEDDING_MODEL = "text-embedding-3-small";
process.env.MAX_UPLOAD_MB = "50";
process.env.MAX_INGESTION_SECONDS = "50";
(process.env as Record<string, string>).NODE_ENV = "test";
