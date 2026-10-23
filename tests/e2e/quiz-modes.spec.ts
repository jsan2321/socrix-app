import { test, expect } from "@playwright/test";

test.describe("Quiz challenge modes", () => {
  test("Identify Both Lies uses checkboxes and submits exactly two statements", async ({ page }) => {
    const sessionId = "550e8400-e29b-41d4-a716-446655440070";
    let submittedStatementIds: string[] = [];

    await page.route("**/api/quiz", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          questionId: "q-lies-mode",
          concept: "Membrane Transport",
          difficulty: "intermediate",
          mode: "identify_both_lies",
          statements: [
            { statementId: "s-truth", text: "Passive transport can move molecules down a concentration gradient." },
            { statementId: "s-lie-1", text: "Diffusion always requires direct ATP hydrolysis." },
            { statementId: "s-lie-2", text: "Osmosis describes the movement of proteins through DNA." },
          ],
        }),
      });
    });

    await page.route(`**/api/sessions/${sessionId}/answers`, async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      submittedStatementIds = body.selectedStatementIds;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          correct: true,
          correctStatementIds: ["s-truth"],
        }),
      });
    });

    await page.goto(`/quiz/${sessionId}`);

    await expect(page.getByText("Select BOTH false claims", { exact: false })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(3);

    await page.getByText("Diffusion always requires direct ATP hydrolysis.").click();
    await page.getByText("Osmosis describes the movement of proteins through DNA.").click();
    await page.locator('label[for="confidence-option-4"]').click();
    await page.getByRole("button", { name: /Submit Answer/ }).click();

    expect(submittedStatementIds.sort()).toEqual(["s-lie-1", "s-lie-2"]);
    await expect(page.getByText("Correct Hypothesis!", { exact: true })).toBeVisible();
  });
});
