import { test, expect } from "@playwright/test";

test.describe("Error Handling & Edge Cases E2E", () => {
  test("displays validation error when a non-PDF file is selected", async ({ page }) => {
    await page.goto("/upload");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Simple plain text notes"),
    });

    const errorBanner = page.locator('[data-testid="dropzone-error"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText("Only text-extractable PDF files are supported");
  });

  test("displays error state when server reports unprocessable scanned PDF", async ({ page }) => {
    const mockDocId = "550e8400-e29b-41d4-a716-446655440070";

    // Intercept Upload POST: returns processing
    await page.route("**/api/documents", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          documentId: mockDocId,
          status: "processing",
        }),
      });
    });

    // Intercept Ingestion Polling: reports failed with likely_scanned
    await page.route(`**/api/documents/${mockDocId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: mockDocId,
          documentId: mockDocId,
          status: "failed",
          failureReason: "likely_scanned",
          pageCount: 5,
          chunksTotal: 0,
          chunksEmbeddedCount: 0,
        }),
      });
    });

    await page.goto("/upload");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "scanned-image.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nScanned Image PDF\n%%EOF"),
    });

    // Verify error UI is displayed with informative copy
    await expect(page.locator("text=Unable to Process Document")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=scanned document without text layer")).toBeVisible();
  });
});
