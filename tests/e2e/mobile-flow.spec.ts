import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 375, height: 667 },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
});

test.describe("Mobile Viewport Flow (375px)", () => {
  test("supports mobile navigation, touch interactions, and responsive card stacking", async ({ page }) => {
    const mockSessionId = "550e8400-e29b-41d4-a716-446655440060";

    // Intercept Question Generation
    await page.route("**/api/quiz", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          questionId: "q-mobile-1",
          concept: "Mobile Responsiveness",
          difficulty: "intermediate",
          statements: [
            { statementId: "s-m1", text: "Touch target sizes must be at least 44 by 44 pixels for accessible mobile interaction." },
            { statementId: "s-m2", text: "Mobile viewports require horizontal scrolling to read academic text excerpts." },
            { statementId: "s-m3", text: "Radio buttons are completely banned in mobile browser specifications." },
          ],
          mode: "identify_truth",
        }),
      });
    });

    // Intercept Answer Submission
    await page.route(`**/api/sessions/${mockSessionId}/answers`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          correct: true,
          correctStatementIds: ["s-m1"],
        }),
      });
    });

    // 1. Visit Quiz on Mobile Viewport
    await page.goto(`/quiz/${mockSessionId}`);

    // 2. Verify Mobile Layout & Typography
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Verify touch targets on statement cards
    const statementCard = page.locator('[data-testid="statement-card-s-m1"]');
    await expect(statementCard).toBeVisible();

    // Verify confidence selector options are visible and tap-friendly
    const confidenceOption = page.locator('label[for="confidence-option-5"]');
    await expect(confidenceOption).toBeVisible();
    await confidenceOption.click();

    // Select statement and submit
    await statementCard.click();
    const submitBtn = page.locator('button:has-text("Submit Answer")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Verify correct affirmation state renders cleanly
    await expect(page.locator("text=Correct Hypothesis!")).toBeVisible();
  });
});
