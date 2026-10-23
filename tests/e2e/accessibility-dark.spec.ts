import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectNoSeriousViolations(page: Page, screen: string) {
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const violations = scan.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious"
  );

  if (violations.length > 0) {
    console.error(`${screen} dark-theme accessibility violations:`, JSON.stringify(violations, null, 2));
  }
  expect(violations).toEqual([]);
}

test("all key screens conform to WCAG 2.1 AA in dark mode", async ({ page }) => {
  const sessionId = "550e8400-e29b-41d4-a716-446655440090";

  await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
  await page.route("**/api/quiz", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        questionId: "q-dark-a11y",
        concept: "Cellular Respiration",
        difficulty: "intermediate",
        mode: "identify_both_lies",
        statements: [
          { statementId: "s-dark-1", text: "Glycolysis occurs in the cytosol." },
          { statementId: "s-dark-2", text: "Oxidative phosphorylation produces no ATP." },
          { statementId: "s-dark-3", text: "The citric acid cycle occurs in the nucleus." },
        ],
      }),
    });
  });
  await page.route(`**/api/sessions/${sessionId}/results`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId,
        documentTitle: "Dark Theme Accessibility",
        totalAnswered: 2,
        accuracy: 0.5,
        confidenceTracer: {
          points: [
            { answeredAt: "2026-09-08T12:00:00Z", questionConcept: "Glycolysis", confidenceLevel: 5, correct: false, usedEvidence: true },
            { answeredAt: "2026-09-08T12:01:00Z", questionConcept: "ATP Synthase", confidenceLevel: 3, correct: true, usedEvidence: false },
          ],
          rollingGap: 0.5,
          overconfidenceRate: 0.5,
          underconfidenceRate: 0,
        },
        confidenceGapAlert: true,
      }),
    });
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expectNoSeriousViolations(page, "Landing page");

  await page.goto("/upload");
  await expectNoSeriousViolations(page, "Upload page");

  await page.goto(`/quiz/${sessionId}`);
  await expect(page.getByText("Cellular Respiration", { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, "Quiz page");

  await page.goto(`/results/${sessionId}`);
  await expect(page.getByTestId("confidence-tracer-chart-container")).toBeVisible();
  await expectNoSeriousViolations(page, "Results page");
});
