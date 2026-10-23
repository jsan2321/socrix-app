import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility (a11y) Audits - WCAG 2.1 Level AA", () => {
  test("landing page conforms to WCAG 2.1 AA accessibility standards", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (criticalViolations.length > 0) {
      console.error("Landing page accessibility violations:", JSON.stringify(criticalViolations, null, 2));
    }
    expect(criticalViolations).toEqual([]);
  });

  test("upload page conforms to WCAG 2.1 AA accessibility standards", async ({ page }) => {
    await page.goto("/upload");
    await page.waitForLoadState("domcontentloaded");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (criticalViolations.length > 0) {
      console.error("Upload page accessibility violations:", JSON.stringify(criticalViolations, null, 2));
    }
    expect(criticalViolations).toEqual([]);
  });

  test("quiz screen conforms to WCAG 2.1 AA accessibility standards", async ({ page }) => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440099";

    // Mock question generation
    await page.route("**/api/quiz", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          questionId: "q-a11y-1",
          concept: "Cellular Respiration",
          difficulty: "intermediate",
          statements: [
            { statementId: "s-1", text: "Glycolysis takes place in the cytosol without requiring oxygen." },
            { statementId: "s-2", text: "Oxidative phosphorylation produces zero ATP molecules." },
            { statementId: "s-3", text: "The citric acid cycle operates inside the cellular nucleus." },
          ],
        }),
      });
    });

    await page.goto(`/quiz/${mockSessionId}`);
    await page.waitForSelector("text=Cellular Respiration", { timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (criticalViolations.length > 0) {
      console.error("Quiz screen accessibility violations:", JSON.stringify(criticalViolations, null, 2));
    }
    expect(criticalViolations).toEqual([]);
  });

  test("results screen with Confidence Tracer and Alert conforms to WCAG 2.1 AA standards", async ({ page }) => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440099";

    // Mock results endpoint
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
              { answeredAt: "2026-09-08T12:00:00Z", questionConcept: "Glycolysis", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: "2026-09-08T12:01:00Z", questionConcept: "Krebs Cycle", confidenceLevel: 4, correct: false, usedEvidence: true },
              { answeredAt: "2026-09-08T12:02:00Z", questionConcept: "ETC", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: "2026-09-08T12:03:00Z", questionConcept: "ATP Synthase", confidenceLevel: 3, correct: true, usedEvidence: false },
              { answeredAt: "2026-09-08T12:04:00Z", questionConcept: "Fermentation", confidenceLevel: 2, correct: true, usedEvidence: false },
            ],
            rollingGap: 0.6,
            overconfidenceRate: 0.6,
            underconfidenceRate: 0.0,
          },
          confidenceGapAlert: true,
        }),
      });
    });

    await page.goto(`/results/${mockSessionId}`);
    await page.waitForSelector("text=Bioenergetics Textbook", { timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (criticalViolations.length > 0) {
      console.error("Results screen accessibility violations:", JSON.stringify(criticalViolations, null, 2));
    }
    expect(criticalViolations).toEqual([]);
  });
});
