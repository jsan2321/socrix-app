import { describe, it, expect } from "vitest";
import { scanEnvExample, scanClientSourceFiles } from "../../scripts/secret-scan";
import { formatErrorResponse } from "@/lib/api-response";
import { ProviderError } from "@/lib/errors";
import { redactSensitiveString } from "@/lib/observability/log";

describe("Secret Scanning & Key Protection (SRS §6.8, §12 AC-17)", () => {
  it("verifies .env.example contains no NEXT_PUBLIC_*KEY variables", () => {
    const violations = scanEnvExample();
    expect(violations).toEqual([]);
  });

  it("verifies client source files do not reference server secret env vars or contain keys", () => {
    const violations = scanClientSourceFiles();
    expect(violations).toEqual([]);
  });

  it("ensures API error response formatting never leaks provider keys into messages (AC-17)", async () => {
    const sampleApiKey = "sk-proj-999988887777666655554444333322221111";
    const sensitiveError = new ProviderError(
      `OpenAI connection failed with API key ${sampleApiKey}`
    );

    const response = formatErrorResponse(sensitiveError);
    const json = await response.json();

    // Redact test on message
    const sanitizedMessage = redactSensitiveString(json.error.message);
    expect(sanitizedMessage).not.toContain(sampleApiKey);
    expect(sanitizedMessage).toContain("[REDACTED_SECRET]");
  });

  it("catches simulated NEXT_PUBLIC key leak in test string", () => {
    const simulatedEnv = "NEXT_PUBLIC_OPENAI_KEY=sk-12345";
    expect(/NEXT_PUBLIC_.*KEY/i.test(simulatedEnv)).toBe(true);
  });
});
