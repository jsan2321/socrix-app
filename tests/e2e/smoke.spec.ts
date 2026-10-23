import { test, expect } from "@playwright/test";

test("smoke test - homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Master Your Reading Through Cross-Examination");
  await expect(page.locator("body")).toContainText("Socratic Cross-Examiner");
});
