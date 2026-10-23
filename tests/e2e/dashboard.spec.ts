import { expect, test } from "@playwright/test";

test("dashboard renders a user library and expandable past sessions", async ({ page }) => {
  await page.route("**/api/documents?limit=12&page=*", async (route) => route.fulfill({ json: { total: 1, page: 1, hasMore: false, documents: [{ id: "doc-1", title: "Cell Biology", status: "ready", createdAt: "2026-09-01T00:00:00.000Z", pageCount: 18, chunksTotal: 32, bestAccuracy: 0.8, averageAccuracy: 0.7, sessions: [{ id: "session-1", createdAt: "2026-09-02T00:00:00.000Z", totalAnswered: 4, accuracy: 0.75 }] }] } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /your study material/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload document" })).toBeVisible();
  await expect(page.getByText("Cell Biology")).toBeVisible();
  await page.getByRole("button", { name: /session history/i }).click();
  await expect(page.getByRole("list", { name: /past sessions/i })).toBeVisible();
});

test("dashboard gives a new learner an upload-first empty state", async ({ page }) => {
  await page.route("**/api/documents?limit=12&page=*", async (route) => route.fulfill({ json: { total: 0, page: 1, hasMore: false, documents: [] } }));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /library starts/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /upload your first document/i })).toHaveAttribute("href", "/upload");
  await expect(page.locator('a[href="/upload"]')).toHaveCount(1);
});
