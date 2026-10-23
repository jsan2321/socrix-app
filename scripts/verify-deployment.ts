/**
 * Automated deployment preflight verification script.
 * Validates environment configuration, database schema connectivity,
 * secret containment, and AI provider health.
 */

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const REQUIRED_TABLES = [
  "documents",
  "document_chunks",
  "quiz_questions",
  "quiz_statements",
  "user_sessions",
  "session_answers",
  "repetition_schedule",
  "rate_limit_logs",
];

async function runPreflightChecks(): Promise<boolean> {
  const { config } = await import("../src/lib/config");
  const { getSupabaseAdminClient } = await import("../src/lib/db/client");
  const { getProvider } = await import("../src/lib/ai/get-provider");
  const results: CheckResult[] = [];
  console.log("==================================================");
  console.log("🚀 Socratic Cross-Examiner — Deployment Preflight");
  console.log("==================================================\n");

  // 1. Environment Variable Checks
  console.log("1. Checking Environment Variables...");
  try {
    const appUrl = config.NEXT_PUBLIC_APP_URL;
    const supabaseUrl = config.SUPABASE_URL;
    const provider = config.AI_PROVIDER;
    const model = config.AI_MODEL;

    results.push({
      name: "Environment Config Schema",
      passed: true,
      message: `Config valid (App: ${appUrl}, DB: ${supabaseUrl}, Provider: ${provider}, Model: ${model})`,
    });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON) {
      results.push({
        name: "Public Supabase Auth Env",
        passed: false,
        message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON are required for browser/middleware Supabase Auth",
      });
    } else {
      results.push({
        name: "Public Supabase Auth Env",
        passed: true,
        message: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON are configured",
      });
    }

    if (process.env.AUTH_TEST_BYPASS === "true" || process.env.E2E_AUTH_BYPASS === "true") {
      results.push({
        name: "Production Auth Bypass Guard",
        passed: false,
        message: "AUTH_TEST_BYPASS or E2E_AUTH_BYPASS is set to 'true' — must be disabled in production",
      });
    } else {
      results.push({
        name: "Production Auth Bypass Guard",
        passed: true,
        message: "Auth test bypass flags are disabled",
      });
    }

    // Check provider API keys
    if (provider === "openai" && !config.OPENAI_API_KEY) {
      results.push({
        name: "Provider API Key",
        passed: false,
        message: "OPENAI_API_KEY is missing for OpenAI provider",
      });
    } else if (provider === "qwen" && !config.QWEN_API_KEY) {
      results.push({
        name: "Provider API Key",
        passed: false,
        message: "QWEN_API_KEY is missing for Qwen provider",
      });
    } else if (provider === "deepseek" && !config.DEEPSEEK_API_KEY) {
      results.push({
        name: "Provider API Key",
        passed: false,
        message: "DEEPSEEK_API_KEY is missing for DeepSeek provider",
      });
    } else {
      results.push({
        name: "Provider API Key",
        passed: true,
        message: `API Key present for active provider '${provider}'`,
      });
    }

    // Embeddings check (OpenAI embeddings required)
    if (!config.OPENAI_API_KEY) {
      results.push({
        name: "Embeddings API Key",
        passed: false,
        message: "OPENAI_API_KEY is required for text-embedding-3-small",
      });
    } else {
      results.push({
        name: "Embeddings API Key",
        passed: true,
        message: "OPENAI_API_KEY present for 1536d embeddings",
      });
    }
  } catch (err: unknown) {
    results.push({
      name: "Environment Config Schema",
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Secret-Leak Safety Check
  console.log("2. Checking Secret Exposure Safety...");
  const publicEnvKeys = Object.keys(process.env).filter((key) =>
    key.startsWith("NEXT_PUBLIC_")
  );
  const leakedKeys = publicEnvKeys.filter(
    (key) =>
      key.includes("KEY") ||
      key.includes("SECRET") ||
      key.includes("ROLE") ||
      key.includes("TOKEN")
  );

  if (leakedKeys.length > 0) {
    results.push({
      name: "Public Secret Containment",
      passed: false,
      message: `Detected sensitive strings prefixed with NEXT_PUBLIC_: ${leakedKeys.join(", ")}`,
    });
  } else {
    results.push({
      name: "Public Secret Containment",
      passed: true,
      message: "No sensitive secrets exposed in NEXT_PUBLIC_* variables",
    });
  }

  // 3. Database Connectivity & Schema Checks
  console.log("3. Validating Supabase Tables & Extensions...");
  try {
    const supabase = getSupabaseAdminClient();

    for (const table of REQUIRED_TABLES) {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) {
        results.push({
          name: `DB Table: ${table}`,
          passed: false,
          message: error.message,
        });
      } else {
        results.push({
          name: `DB Table: ${table}`,
          passed: true,
          message: "Accessible",
        });
      }
    }

    // Check RPC function
    const dummyVector = new Array(1536).fill(0);
    const { error: rpcError } = await supabase.rpc("match_document_chunks", {
      query_embedding: dummyVector,
      match_document_id: "00000000-0000-0000-0000-000000000000",
      match_threshold: 0.99,
      match_count: 1,
    });

    if (rpcError && !rpcError.message.includes("does not exist")) {
      results.push({
        name: "RPC: match_document_chunks",
        passed: true,
        message: "RPC is defined and callable",
      });
    } else if (rpcError && rpcError.message.includes("does not exist")) {
      results.push({
        name: "RPC: match_document_chunks",
        passed: false,
        message: "Function match_document_chunks does not exist in database",
      });
    } else {
      results.push({
        name: "RPC: match_document_chunks",
        passed: true,
        message: "RPC is defined and callable",
      });
    }
  } catch (err: unknown) {
    results.push({
      name: "Supabase Connection",
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. AI Provider Connectivity Check
  console.log("4. Checking AI Provider Health...");
  try {
    const providerInstance = getProvider();
    const health = await providerInstance.healthCheck();
    if (health.ok) {
      results.push({
        name: `AI Health: ${providerInstance.name}`,
        passed: true,
        message: `Healthy (Latency: ${health.latencyMs}ms)`,
      });
    } else {
      results.push({
        name: `AI Health: ${providerInstance.name}`,
        passed: false,
        message: health.error || "Provider reported unhealthy status",
      });
    }
  } catch (err: unknown) {
    results.push({
      name: "AI Provider Health",
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Print Summary Table
  console.log("\n==================================================");
  console.log("📋 Preflight Results Summary");
  console.log("==================================================");

  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? "✅" : "❌";
    console.log(`${symbol} [${r.name}]: ${r.message}`);
    if (!r.passed) {
      allPassed = false;
    }
  }

  console.log("==================================================");
  if (allPassed) {
    console.log("🎉 ALL PREFLIGHT CHECKS PASSED — Ready for deployment!");
  } else {
    console.log("⚠️ PREFLIGHT FAILED — Resolve the errors above before deploying.");
  }
  console.log("==================================================\n");

  return allPassed;
}

runPreflightChecks()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal preflight execution error:", err);
    process.exit(1);
  });
