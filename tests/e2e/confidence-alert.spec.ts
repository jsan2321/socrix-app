import { test, expect } from "@playwright/test";

test.describe("Confidence Gap Alert Behavioral Triggers E2E", () => {
  test("renders Confidence Gap Alert banner when overconfidence pattern is present (confidence >= 4 and incorrect)", async ({ page }) => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440080";

    await page.route(`**/api/sessions/${mockSessionId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId: mockSessionId,
          documentTitle: "Physics Textbook",
          totalAnswered: 5,
          accuracy: 0.2,
          confidenceTracer: {
            points: [
              { answeredAt: new Date().toISOString(), questionConcept: "Entropy", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Enthalpy", confidenceLevel: 4, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Free Energy", confidenceLevel: 5, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Carnot Cycle", confidenceLevel: 4, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Adiabatic Work", confidenceLevel: 3, correct: true, usedEvidence: false },
            ],
            rollingGap: 0.7,
            overconfidenceRate: 0.8,
            underconfidenceRate: 0.0,
          },
          confidenceGapAlert: true,
          questions: [],
        }),
      });
    });

    await page.goto(`/results/${mockSessionId}`);

    // Alert banner should be rendered
    const alertContainer = page.locator('[data-testid="confidence-gap-alert-banner"]');
    await expect(alertContainer).toBeVisible();
    await expect(alertContainer).toContainText("Confidence–Accuracy Gap Detected");
  });

  test("suppresses Confidence Gap Alert banner when answers are calibrated or low-confidence", async ({ page }) => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440081";

    await page.route(`**/api/sessions/${mockSessionId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId: mockSessionId,
          documentTitle: "Physics Textbook",
          totalAnswered: 5,
          accuracy: 0.2,
          confidenceTracer: {
            points: [
              { answeredAt: new Date().toISOString(), questionConcept: "Entropy", confidenceLevel: 2, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Enthalpy", confidenceLevel: 1, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Free Energy", confidenceLevel: 2, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Carnot Cycle", confidenceLevel: 2, correct: false, usedEvidence: true },
              { answeredAt: new Date().toISOString(), questionConcept: "Adiabatic Work", confidenceLevel: 1, correct: true, usedEvidence: false },
            ],
            rollingGap: 0.1,
            overconfidenceRate: 0.0,
            underconfidenceRate: 0.0,
          },
          confidenceGapAlert: false,
          questions: [],
        }),
      });
    });

    await page.goto(`/results/${mockSessionId}`);

    // Alert banner should NOT be rendered
    const alertContainer = page.locator('[data-testid="confidence-gap-alert-banner"]');
    await expect(alertContainer).not.toBeVisible();
  });
});
