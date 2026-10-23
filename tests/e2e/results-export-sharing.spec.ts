import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const sessionId = "550e8400-e29b-41d4-a716-446655440999";

test.describe("Results Export & Sharing Flow", () => {
  test("renders human-centric metrics, opens share modal, copies link, and meets accessibility standards", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    // Mock the session results route
    await page.route(`**/api/sessions/${sessionId}/results`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId,
          documentTitle: "Bioenergetics Textbook",
          totalAnswered: 2,
          accuracy: 1.0,
          confidenceTracer: {
            points: [
              {
                answeredAt: "2026-09-29T12:00:00Z",
                questionConcept: "Cellular Respiration",
                confidenceLevel: 5,
                correct: true,
                usedEvidence: false,
              },
              {
                answeredAt: "2026-09-29T12:01:00Z",
                questionConcept: "ATP Synthase",
                confidenceLevel: 4,
                correct: true,
                usedEvidence: true,
              },
            ],
            rollingGap: 0.1,
            overconfidenceRate: 0.0,
            underconfidenceRate: 0.0,
          },
          confidenceGapAlert: false,
        }),
      });
    });

    // 1. Visit Results Page
    await page.goto(`/results/${sessionId}`);

    // Verify document title and human-centric metrics
    await expect(page.getByText("Bioenergetics Textbook")).toBeVisible();
    await expect(page.getByText("Mastery Score")).toBeVisible();
    await expect(page.getByText("Spot-On Alignment")).toBeVisible();
    await expect(page.getByText("Diagnostic Balance")).toBeVisible();

    // Verify question diagnostic badge
    await expect(page.getByText("Mastered").first()).toBeVisible();

    // Verify Share Results button is visible
    const shareButton = page.getByRole("button", { name: /Share Results/i });
    await expect(shareButton).toBeVisible();

    // 2. Open Share Modal
    await shareButton.click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(page.getByText("Share Study Results")).toBeVisible();
    await expect(page.getByText("Public Study Link")).toBeVisible();

    // Verify the share URL contains /share/sessionId
    const shareInput = page.getByRole("textbox", { name: /Public Study Link/i });
    await expect(shareInput).toHaveValue(new RegExp(`/share/${sessionId}`));

    // Click Copy Link button and check feedback
    const copyButton = page.getByRole("button", { name: /Copy Link/i });
    await copyButton.click();
    await expect(page.getByText(/Link copied/i)).toBeVisible();

    // Verify text summary preview is present
    await expect(page.getByText("Study Session Dossier")).toBeVisible();

    // Close modal via Escape
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();

    // 3. Accessibility Scan (WCAG 2.1 AA)
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const criticalViolations = scan.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations).toEqual([]);
  });
});
