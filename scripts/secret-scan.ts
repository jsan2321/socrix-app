import fs from "fs";
import path from "path";

/**
 * Automated Secret Scanner (SRS §6.8, §12 AC-17)
 * Scans environment templates, client files, and sample logs for sensitive credentials.
 */

const ROOT_DIR = path.resolve(__dirname, "..");

const CLIENT_DIRS = [
  path.join(ROOT_DIR, "src", "app"),
  path.join(ROOT_DIR, "src", "components"),
];

const SECRET_PATTERNS = [
  { name: "OpenAI Secret Key", regex: /sk-[a-zA-Z0-9_-]{32,}/g },
  { name: "Supabase Service Key", regex: /sbp_[a-zA-Z0-9]{32,}/g },
  { name: "JWT Bearer Header", regex: /bearer\s+ey[a-zA-Z0-9_\-\.]{30,}/gi },
];

export function scanEnvExample(): string[] {
  const violations: string[] = [];
  const envExamplePath = path.join(ROOT_DIR, ".env.example");

  if (!fs.existsSync(envExamplePath)) {
    violations.push(".env.example does not exist");
    return violations;
  }

  const content = fs.readFileSync(envExamplePath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    // Check if any NEXT_PUBLIC_ variable contains KEY
    if (/NEXT_PUBLIC_.*KEY/i.test(line)) {
      violations.push(`Violation in .env.example: Public key variable exposed: ${line.trim()}`);
    }
  }

  return violations;
}

export function scanClientSourceFiles(): string[] {
  const violations: string[] = [];

  function walkDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "api" && entry.name !== "node_modules" && entry.name !== ".next") {
          walkDir(fullPath);
        }
      } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const fileContent = fs.readFileSync(fullPath, "utf-8");

        // Check for server-only environment variable usage on client
        const serverSecrets = [
          "SUPABASE_SERVICE_ROLE_KEY",
          "OPENAI_API_KEY",
          "QWEN_API_KEY",
          "DEEPSEEK_API_KEY",
        ];

        for (const secret of serverSecrets) {
          if (fileContent.includes(`process.env.${secret}`)) {
            violations.push(
              `Client source file ${path.relative(ROOT_DIR, fullPath)} directly references server secret ${secret}`
            );
          }
        }

        // Check for raw secret strings
        for (const { name, regex } of SECRET_PATTERNS) {
          if (regex.test(fileContent)) {
            violations.push(
              `Client source file ${path.relative(ROOT_DIR, fullPath)} contains pattern: ${name}`
            );
          }
        }
      }
    }
  }

  for (const clientDir of CLIENT_DIRS) {
    walkDir(clientDir);
  }

  return violations;
}

export function runSecretScan(): boolean {
  console.log("Starting automated secret scan...");

  const envViolations = scanEnvExample();
  const clientViolations = scanClientSourceFiles();

  const allViolations = [...envViolations, ...clientViolations];

  if (allViolations.length > 0) {
    console.error("❌ Secret Scan FAILED with violations:");
    for (const v of allViolations) {
      console.error(`  - ${v}`);
    }
    return false;
  }

  console.log("✅ Secret Scan PASSED: No client-exposed keys or secret leaks detected.");
  return true;
}

// CLI Execution
if (require.main === module || process.argv[1]?.includes("secret-scan")) {
  const success = runSecretScan();
  process.exit(success ? 0 : 1);
}
