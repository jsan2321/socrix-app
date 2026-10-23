import { test, expect, type Page } from "@playwright/test";

type Theme = "light" | "dark";

const sessionId = "550e8400-e29b-41d4-a716-446655440080";

async function prepareTheme(page: Page, theme: Theme) {
  await page.addInitScript((selectedTheme) => {
    window.localStorage.setItem("theme", selectedTheme);
  }, theme);
}

async function stabilize(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      nextjs-portal { display: none !important; }
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
}

async function expectVisual(page: Page, name: string) {
  await stabilize(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`landing page — ${theme}`, async ({ page }) => {
    await prepareTheme(page, theme);
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expectVisual(page, `landing-${theme}`);
  });

  test(`upload page — ${theme}`, async ({ page }) => {
    await prepareTheme(page, theme);
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Upload Study Material" })).toBeVisible();
    await expectVisual(page, `upload-${theme}`);
  });

  test(`quiz page — ${theme}`, async ({ page }) => {
    await prepareTheme(page, theme);
    await page.route("**/api/quiz", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          questionId: "q-visual",
          concept: "Enzyme Saturation Kinetics",
          difficulty: "intermediate",
          mode: "identify_both_lies",
          statements: [
            { statementId: "s-v1", text: "Reaction rate approaches Vmax as substrate concentration increases." },
            { statementId: "s-v2", text: "Enzymes permanently increase the equilibrium constant of a reaction." },
            { statementId: "s-v3", text: "Km is the exact substrate concentration at which every enzyme denatures." },
          ],
        }),
      });
    });

    await page.goto(`/quiz/${sessionId}`);
    await expect(page.getByText("Enzyme Saturation Kinetics", { exact: true })).toBeVisible();
    await expect(page.locator('[data-question-ready="true"]')).toBeVisible();
    await expectVisual(page, `quiz-${theme}`);
  });

  test(`results page — ${theme}`, async ({ page }) => {
    await prepareTheme(page, theme);
    await page.route(`**/api/sessions/${sessionId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId,
          documentTitle: "Bioenergetics Textbook",
          totalAnswered: 3,
          accuracy: 2 / 3,
          confidenceTracer: {
            points: [
              { answeredAt: "2026-09-08T12:00:00Z", questionConcept: "Glycolysis", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: "2026-09-08T12:01:00Z", questionConcept: "Krebs Cycle", confidenceLevel: 4, correct: true, usedEvidence: false },
              { answeredAt: "2026-09-08T12:02:00Z", questionConcept: "ATP Synthase", confidenceLevel: 3, correct: true, usedEvidence: false },
            ],
            rollingGap: 0.33,
            overconfidenceRate: 0.33,
            underconfidenceRate: 0,
          },
          confidenceGapAlert: true,
          questions: [
            { questionId: "q-v1", concept: "Glycolysis", correct: false, confidenceLevel: 5, usedEvidence: true },
            { questionId: "q-v2", concept: "Krebs Cycle", correct: true, confidenceLevel: 4, usedEvidence: false },
            { questionId: "q-v3", concept: "ATP Synthase", correct: true, confidenceLevel: 3, usedEvidence: false },
          ],
        }),
      });
    });

    await page.goto(`/results/${sessionId}`);
    await expect(page.getByText("Bioenergetics Textbook", { exact: true })).toBeVisible();
    await expect(page.getByTestId("confidence-tracer-chart-container")).toBeVisible();
    await expect(page.getByText("67%", { exact: true })).toBeVisible();
    await expectVisual(page, `results-${theme}`);
  });
}
