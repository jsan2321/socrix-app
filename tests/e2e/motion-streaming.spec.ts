import { expect, test } from "@playwright/test";

test("reduced motion reveals a validated question without a timed delay", async ({ page }) => {
  const sessionId = "550e8400-e29b-41d4-a716-446655440080";
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/quiz", async (route) => route.fulfill({
    status: 201,
    contentType: "application/json",
    body: JSON.stringify({
      questionId: "q-motion", concept: "Cell Biology", difficulty: "foundational", mode: "identify_truth",
      statements: [
        { statementId: "s-1", text: "Cells contain membranes." },
        { statementId: "s-2", text: "Cells have no internal structures." },
        { statementId: "s-3", text: "Cell membranes are made entirely of iron." },
      ],
    }),
  }));
  await page.goto(`/quiz/${sessionId}`);
  await expect(page.locator('[data-question-ready="true"]')).toBeVisible();
  await expect(page.getByText("Cells contain membranes.")).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeEnabled();
});

test("upload progress is indeterminate until the server reports a total", async ({ page }) => {
  const documentId = "550e8400-e29b-41d4-a716-446655440090";
  let reportTotal = false;
  await page.route("**/api/documents", async (route) => route.fulfill({ json: { documentId, status: "processing" } }));
  await page.route(`**/api/documents/${documentId}`, async (route) => route.fulfill({
    json: { documentId, status: "processing", chunksEmbeddedCount: 4, chunksTotal: reportTotal ? 10 : null },
  }));
  await page.goto("/upload");
  await page.getByTestId("dropzone-file-input").setInputFiles("tests/fixtures/pdfs/valid-chapter.pdf");
  const progressbar = page.getByRole("progressbar", { name: "Document ingestion" });
  await expect(progressbar).toBeVisible();
  await expect(progressbar).not.toHaveAttribute("aria-valuenow");
  reportTotal = true;
  await expect(progressbar).toHaveAttribute("aria-valuenow", "40", { timeout: 5000 });
});
