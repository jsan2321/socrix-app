/**
 * Production and staging smoke test script.
 * Validates full end-to-end functionality against a live deployed URL or local server.
 */

import fs from "node:fs";
import path from "node:path";

const TARGET_URL = (process.env.TARGET_URL || "http://localhost:3000").replace(/\/$/, "");
const FIXTURE_PATH = path.resolve(__dirname, "../tests/fixtures/pdfs/valid-chapter.pdf");

interface StepResult {
  step: string;
  success: boolean;
  details: string;
  durationMs: number;
}

const steps: StepResult[] = [];

function assertNoSecrets(payload: string, context: string): void {
  const patterns = [
    /sk-[a-zA-Z0-9_\-]{20,}/gi,
    /sbp_[a-zA-Z0-9]{20,}/gi,
    /service_role/gi,
  ];
  for (const pattern of patterns) {
    if (pattern.test(payload)) {
      throw new Error(`Potential secret leak detected in ${context}!`);
    }
  }
}

async function runSmokeTests() {
  console.log("==================================================");
  console.log(`🌐 Production Smoke Test against: ${TARGET_URL}`);
  console.log("==================================================\n");

  // Step 1: Homepage availability
  const t0 = Date.now();
  try {
    console.log("Step 1: Testing Homepage availability (GET /)...");
    const res = await fetch(`${TARGET_URL}/`);
    const text = await res.text();
    assertNoSecrets(text, "Homepage HTML");
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    steps.push({
      step: "Homepage (GET /)",
      success: true,
      details: `HTTP 200 OK (${text.length} bytes)`,
      durationMs: Date.now() - t0,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Homepage (GET /)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t0,
    });
    return reportAndExit();
  }

  // Step 2: Document Ingestion
  let documentId: string | null = null;
  const t1 = Date.now();
  try {
    console.log("Step 2: Testing Document Ingestion (POST /api/documents)...");
    if (!fs.existsSync(FIXTURE_PATH)) {
      throw new Error(`Test fixture PDF missing at ${FIXTURE_PATH}`);
    }

    const fileBuffer = fs.readFileSync(FIXTURE_PATH);
    const blob = new Blob([fileBuffer], { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", blob, "smoke-test-chapter.pdf");
    formData.append("title", "Smoke Test Chapter");

    const res = await fetch(`${TARGET_URL}/api/documents`, {
      method: "POST",
      body: formData,
    });

    const resText = await res.text();
    assertNoSecrets(resText, "Document Ingestion Response");
    const json = JSON.parse(resText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    documentId = json.documentId;
    steps.push({
      step: "Document Ingestion (POST /api/documents)",
      success: true,
      details: `Document created with ID: ${documentId} (status: ${json.status})`,
      durationMs: Date.now() - t1,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Document Ingestion (POST /api/documents)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t1,
    });
    return reportAndExit();
  }

  // Step 3: Poll Ingestion Status
  const t2 = Date.now();
  try {
    console.log(`Step 3: Polling Document Status (GET /api/documents/${documentId})...`);
    let ready = false;
    const maxAttempts = 15;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const res = await fetch(`${TARGET_URL}/api/documents/${documentId}`);
      const resText = await res.text();
      assertNoSecrets(resText, "Status Polling Response");
      const json = JSON.parse(resText);

      if (json.status === "ready") {
        ready = true;
        break;
      } else if (json.status === "failed") {
        throw new Error(`Document processing failed: ${json.failureReason}`);
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!ready) {
      throw new Error(`Document status timed out after ${maxAttempts * 2}s`);
    }

    steps.push({
      step: "Status Polling (GET /api/documents/[id])",
      success: true,
      details: "Document transitioned to 'ready'",
      durationMs: Date.now() - t2,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Status Polling (GET /api/documents/[id])",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t2,
    });
    return reportAndExit();
  }

  // Step 4: Create User Session
  let sessionId: string | null = null;
  const t3 = Date.now();
  try {
    console.log("Step 4: Creating Study Session (POST /api/sessions)...");
    const res = await fetch(`${TARGET_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        mode: "identify_truth",
      }),
    });

    const resText = await res.text();
    assertNoSecrets(resText, "Session Creation Response");
    const json = JSON.parse(resText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    sessionId = json.sessionId;
    steps.push({
      step: "Session Creation (POST /api/sessions)",
      success: true,
      details: `Session ID: ${sessionId}`,
      durationMs: Date.now() - t3,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Session Creation (POST /api/sessions)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t3,
    });
    return reportAndExit();
  }

  // Step 5: Quiz Generation
  let questionId: string | null = null;
  let statementIds: string[] = [];
  const t4 = Date.now();
  try {
    console.log("Step 5: Generating Quiz Questions (POST /api/quiz)...");
    const res = await fetch(`${TARGET_URL}/api/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId,
        questionCount: 1,
        difficulty: "foundational",
      }),
    });

    const resText = await res.text();
    assertNoSecrets(resText, "Quiz Generation Response");
    const json = JSON.parse(resText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    if (!json.questions || json.questions.length === 0) {
      throw new Error("No questions returned from quiz generator");
    }

    const firstQuestion = json.questions[0];
    questionId = firstQuestion.id;
    statementIds = firstQuestion.statements.map((s: { id: string }) => s.id);

    // Verify truth is masked in response
    for (const stmt of firstQuestion.statements) {
      if ("isTrue" in stmt || "is_true" in stmt) {
        throw new Error("Truth was not masked in client quiz response!");
      }
    }

    steps.push({
      step: "Quiz Generation (POST /api/quiz)",
      success: true,
      details: `Generated question for concept: "${firstQuestion.concept}" with ${statementIds.length} statements`,
      durationMs: Date.now() - t4,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Quiz Generation (POST /api/quiz)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t4,
    });
    return reportAndExit();
  }

  // Step 6: Submit Answer
  const t5 = Date.now();
  try {
    console.log("Step 6: Submitting Answer (POST /api/sessions/[id]/answers)...");
    const res = await fetch(`${TARGET_URL}/api/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        selectedStatementIds: [statementIds[0]],
        confidenceLevel: 4,
      }),
    });

    const resText = await res.text();
    assertNoSecrets(resText, "Answer Submission Response");
    const json = JSON.parse(resText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    steps.push({
      step: "Answer Submission (POST /api/sessions/[id]/answers)",
      success: true,
      details: `Answer recorded (correct: ${json.correct}, revealed truth statement: ${json.correctStatementIds?.[0]})`,
      durationMs: Date.now() - t5,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Answer Submission (POST /api/sessions/[id]/answers)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t5,
    });
    return reportAndExit();
  }

  // Step 7: Retrieve Evidence
  const t6 = Date.now();
  try {
    console.log("Step 7: Retrieving Grounded Evidence (POST /api/evidence)...");
    const res = await fetch(`${TARGET_URL}/api/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId,
        sessionId,
      }),
    });

    const resText = await res.text();
    assertNoSecrets(resText, "Evidence Retrieval Response");
    const json = JSON.parse(resText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    steps.push({
      step: "Evidence Retrieval (POST /api/evidence)",
      success: true,
      details: `Retrieved chunk from page ${json.evidence?.pageStart}, similarity: ${json.evidence?.similarity ?? "direct"}`,
      durationMs: Date.now() - t6,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Evidence Retrieval (POST /api/evidence)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t6,
    });
    return reportAndExit();
  }

  // Step 8: Session Results & Confidence Tracer
  const t7 = Date.now();
  try {
    console.log("Step 8: Fetching Session Results (GET /api/sessions/[id]/results)...");
    const res = await fetch(`${TARGET_URL}/api/sessions/${sessionId}/results`);
    const resText = await res.text();
    assertNoSecrets(resText, "Session Results Response");
    const json = JSON.parse(resText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
    }

    steps.push({
      step: "Session Results (GET /api/sessions/[id]/results)",
      success: true,
      details: `Accuracy: ${json.accuracy * 100}%, rolling gap: ${json.confidenceTracer?.rollingGap}, alert: ${json.confidenceGapAlert}`,
      durationMs: Date.now() - t7,
    });
  } catch (err: unknown) {
    steps.push({
      step: "Session Results (GET /api/sessions/[id]/results)",
      success: false,
      details: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - t7,
    });
    return reportAndExit();
  }

  reportAndExit();
}

function reportAndExit() {
  console.log("\n==================================================");
  console.log("📊 Smoke Test Results Summary");
  console.log("==================================================");

  let allPassed = true;
  for (const s of steps) {
    const symbol = s.success ? "✅" : "❌";
    console.log(`${symbol} [${s.step}] (${s.durationMs}ms): ${s.details}`);
    if (!s.success) {
      allPassed = false;
    }
  }

  console.log("==================================================");
  if (allPassed) {
    console.log("🎉 ALL SMOKE TESTS PASSED — End-to-end journey verified!");
  } else {
    console.log("⚠️ SMOKE TESTS FAILED — Review failed steps above.");
  }
  console.log("==================================================\n");

  process.exit(allPassed ? 0 : 1);
}

runSmokeTests().catch((err) => {
  console.error("Fatal error during smoke test:", err);
  process.exit(1);
});
