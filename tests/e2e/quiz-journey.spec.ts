import { test, expect } from "@playwright/test";

test.describe("Full End-to-End User Journey: Upload to Results", () => {
  test("completes full active recall workflow with Confidence Tracer and Evidence Panel", async ({ page }) => {
    const mockDocId = "550e8400-e29b-41d4-a716-446655440050";
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440051";

    let currentQuestionIndex = 0;
    const questions = [
      {
        questionId: "q-1",
        concept: "Cellular Bioenergetics",
        difficulty: "intermediate",
        statements: [
          { statementId: "s-1a", text: "ATP synthesis requires a proton gradient across the inner mitochondrial membrane." },
          { statementId: "s-1b", text: "ATP synthesis occurs strictly without membrane involvement in the nucleus." },
          { statementId: "s-1c", text: "Electrons flow backwards from oxygen to glucose during aerobic respiration." },
        ],
        trueId: "s-1a",
      },
      {
        questionId: "q-2",
        concept: "Glycolysis Products",
        difficulty: "foundational",
        statements: [
          { statementId: "s-2a", text: "Glycolysis produces a net yield of two ATP molecules and two pyruvate molecules." },
          { statementId: "s-2b", text: "Glycolysis consumes forty molecules of glucose to produce one molecule of water." },
          { statementId: "s-2c", text: "Glycolysis takes place exclusively inside extracellular fluid." },
        ],
        trueId: "s-2a",
      },
      {
        questionId: "q-3",
        concept: "Citric Acid Cycle",
        difficulty: "intermediate",
        statements: [
          { statementId: "s-3a", text: "Oxaloacetate combines with acetyl-CoA to regenerate citrate in each turn." },
          { statementId: "s-3b", text: "The citric acid cycle generates oxygen gas from dissolved nitrogen." },
          { statementId: "s-3c", text: "Citric acid cycle reactions happen outside the cell wall in bacteria." },
        ],
        trueId: "s-3a",
      },
      {
        questionId: "q-4",
        concept: "Electron Transport Chain",
        difficulty: "advanced",
        statements: [
          { statementId: "s-4a", text: "Complexes I, III, and IV pump protons into the intermembrane space." },
          { statementId: "s-4b", text: "Protons are destroyed during electron transport to create light." },
          { statementId: "s-4c", text: "Complex II directly splits carbon dioxide into carbon atoms." },
        ],
        trueId: "s-4a",
      },
      {
        questionId: "q-5",
        concept: "Fermentation",
        difficulty: "foundational",
        statements: [
          { statementId: "s-5a", text: "Lactate dehydrogenase reduces pyruvate to regenerate the NAD+ pool." },
          { statementId: "s-5b", text: "Fermentation produces pure uranium atoms in anaerobic muscle cells." },
          { statementId: "s-5c", text: "Lactic acid fermentation requires atmospheric pressure above 100 atmospheres." },
        ],
        trueId: "s-5a",
      },
    ];

    // Intercept Upload Document API
    await page.route("**/api/documents", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            documentId: mockDocId,
            status: "processing",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Intercept Ingestion Polling Status
    await page.route(`**/api/documents/${mockDocId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: mockDocId,
          status: "ready",
          page_count: 5,
          chunks_total: 10,
          chunks_embedded_count: 10,
        }),
      });
    });

    // Intercept Session Creation
    await page.route("**/api/sessions", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId: mockSessionId,
          sessionToken: "550e8400-e29b-41d4-a716-446655440052",
        }),
      });
    });

    // Intercept Quiz Question Generation
    await page.route("**/api/quiz", async (route) => {
      const q = questions[currentQuestionIndex];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          questionId: q.questionId,
          concept: q.concept,
          difficulty: q.difficulty,
          statements: q.statements,
          mode: "identify_truth",
        }),
      });
    });

    // Intercept Answer Submissions
    await page.route(`**/api/sessions/${mockSessionId}/answers`, async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      const q = questions[currentQuestionIndex];
      const isCorrect = body.selectedStatementIds?.[0] === q.trueId;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          correct: isCorrect,
          correctStatementIds: [q.trueId],
        }),
      });
    });

    // Intercept Evidence Retrieval
    await page.route("**/api/evidence", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          evidence: {
            chunk_id: "chunk-evidence-1",
            document_id: mockDocId,
            text: "ATP synthase utilizes the proton-motive force generated by electron transport complexes across the inner membrane.",
            similarity_score: 0.89,
            page_start: 2,
            page_end: 2,
            paragraph_start: 3,
            paragraph_end: 3,
            sentence_start: 1,
            sentence_end: 2,
            heading: "Mitochondrial Bioenergetics",
            is_origin_chunk: true,
          },
        }),
      });
    });

    // Intercept Session Results
    await page.route(`**/api/sessions/${mockSessionId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId: mockSessionId,
          documentTitle: "Bioenergetics Textbook",
          totalAnswered: 5,
          accuracy: 0.4,
          confidenceTracer: {
            points: [
              { answeredAt: new Date().toISOString(), questionConcept: "Cellular Bioenergetics", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Glycolysis Products", confidenceLevel: 4, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Citric Acid Cycle", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Electron Transport Chain", confidenceLevel: 3, correct: true, usedEvidence: false },
              { answeredAt: new Date().toISOString(), questionConcept: "Fermentation", confidenceLevel: 2, correct: true, usedEvidence: false },
            ],
            rollingGap: 0.6,
            overconfidenceRate: 0.6,
            underconfidenceRate: 0.0,
          },
          confidenceGapAlert: true,
          questions: [
            { questionId: "q-1", concept: "Cellular Bioenergetics", correct: false, confidenceLevel: 5, usedEvidence: true },
            { questionId: "q-2", concept: "Glycolysis Products", correct: false, confidenceLevel: 4, usedEvidence: true },
            { questionId: "q-3", concept: "Citric Acid Cycle", correct: false, confidenceLevel: 5, usedEvidence: true },
            { questionId: "q-4", concept: "Electron Transport Chain", correct: true, confidenceLevel: 3, usedEvidence: false },
            { questionId: "q-5", concept: "Fermentation", correct: true, confidenceLevel: 2, usedEvidence: false },
          ],
        }),
      });
    });

    // 1. Visit Landing Page
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Master Your Reading Through Cross-Examination");

    // 2. Navigate to Upload
    await page.click("text=Begin Session");
    await expect(page).toHaveURL("/upload");

    // 3. Upload File
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "bioenergetics.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nBioenergetics chapter\n%%EOF"),
    });

    // Wait for Ready state
    await expect(page.locator("text=Select Your Challenge Mode")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Identify the Truth")).toBeVisible();

    // Start Session
    await page.click("text=Start Cross-Examination Quiz");
    await expect(page).toHaveURL(`/quiz/${mockSessionId}`);

    // Q1: Overconfident incorrect (Confidence 5, pick lie s-1b)
    await expect(page.getByText("Cellular Bioenergetics", { exact: true })).toBeVisible();
    await page.click('label[for="confidence-option-5"]');
    await page.click('text=ATP synthesis occurs strictly without membrane involvement in the nucleus.');
    await page.click('button:has-text("Submit Answer")');
    await expect(page.locator("text=Incorrect Hypothesis")).toBeVisible();
    await expect(page.locator('[data-testid="evidence-panel-container"]')).toBeVisible();

    // Advance to Q2
    currentQuestionIndex = 1;
    await page.click('button:has-text("Continue to Next Question")');

    // Q2: High confidence incorrect (Confidence 4, pick lie s-2b)
    await expect(page.getByText("Glycolysis Products", { exact: true })).toBeVisible();
    await page.click('label[for="confidence-option-4"]');
    await page.click('text=Glycolysis consumes forty molecules of glucose to produce one molecule of water.');
    await page.click('button:has-text("Submit Answer")');
    await expect(page.locator("text=Incorrect Hypothesis")).toBeVisible();

    // Advance to Q3
    currentQuestionIndex = 2;
    await page.click('button:has-text("Continue to Next Question")');

    // Q3: Overconfident incorrect (Confidence 5, pick lie s-3b)
    await expect(page.getByText("Citric Acid Cycle", { exact: true })).toBeVisible();
    await page.click('label[for="confidence-option-5"]');
    await page.click('text=The citric acid cycle generates oxygen gas from dissolved nitrogen.');
    await page.click('button:has-text("Submit Answer")');
    await expect(page.locator("text=Incorrect Hypothesis")).toBeVisible();

    // Advance to Q4
    currentQuestionIndex = 3;
    await page.click('button:has-text("Continue to Next Question")');

    // Q4: Moderate confidence correct (Confidence 3, pick truth s-4a)
    await expect(page.getByText("Electron Transport Chain", { exact: true })).toBeVisible();
    await page.click('label[for="confidence-option-3"]');
    await page.click('text=Complexes I, III, and IV pump protons into the intermembrane space.');
    await page.click('button:has-text("Submit Answer")');
    await expect(page.locator("text=Correct Hypothesis!")).toBeVisible();

    // Advance to Q5
    currentQuestionIndex = 4;
    await page.click('button:has-text("Next Question")');

    // Q5: Low confidence correct (Confidence 2, pick truth s-5a)
    await expect(page.getByText("Fermentation", { exact: true })).toBeVisible();
    await page.click('label[for="confidence-option-2"]');
    await page.click('text=Lactate dehydrogenase reduces pyruvate to regenerate the NAD+ pool.');
    await page.click('button:has-text("Submit Answer")');
    await expect(page.locator("text=Correct Hypothesis!")).toBeVisible();

    // Click Finish & View Results in header
    await page.click('button:has-text("Finish & View Results")');
    await expect(page).toHaveURL(`/results/${mockSessionId}`);

    // Verify Results Page
    await expect(page.locator("text=Performance & Calibration")).toBeVisible();
    await expect(page.locator('[data-testid="confidence-tracer-chart-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="confidence-gap-alert-banner"]')).toBeVisible();
    await expect(page.locator("text=Confidence–Accuracy Gap Detected")).toBeVisible();
    await expect(page.locator("text=Question Breakdown")).toBeVisible();
  });
});
