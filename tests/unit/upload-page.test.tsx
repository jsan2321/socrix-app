import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UploadPage from "@/app/upload/page";
import { I18nProvider } from "@/lib/i18n/context";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("UploadPage Staging and Analysis Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("stages selected PDF without immediately calling /api/documents", async () => {
    render(
      <I18nProvider>
        <UploadPage />
      </I18nProvider>
    );

    // Initial state: Dropzone is rendered
    expect(screen.getByTestId("dropzone-container")).toBeDefined();

    // Select a PDF file
    const fileInput = screen.getByTestId("dropzone-file-input");
    const pdfFile = new File(["%PDF-1.4 dummy"], "Bases_de_datos.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    // File is staged: fetch (/api/documents) has NOT been called yet
    expect(global.fetch).not.toHaveBeenCalled();

    // Shows staged document review card with filename, size, and Analyze button
    expect(screen.getByText("Bases_de_datos.pdf")).toBeDefined();
    expect(screen.getByText(/Process & Analyze Document/i)).toBeDefined();

    // Document title input is pre-populated
    const stagedTitleInput = screen.getByLabelText(/Document Title/i) as HTMLInputElement;
    expect(stagedTitleInput.value).toBe("Bases_de_datos");
  });

  it("allows user to cancel/remove staged file and return to dropzone", async () => {
    render(
      <I18nProvider>
        <UploadPage />
      </I18nProvider>
    );

    const fileInput = screen.getByTestId("dropzone-file-input");
    const pdfFile = new File(["%PDF-1.4 dummy"], "Bases_de_datos.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    expect(screen.getByText("Bases_de_datos.pdf")).toBeDefined();

    // Click "Choose a different file"
    const changeFileBtn = screen.getByRole("button", { name: /Choose a different file/i });
    fireEvent.click(changeFileBtn);

    // Returns back to dropzone
    expect(screen.getByTestId("dropzone-container")).toBeDefined();
    expect(screen.queryByText("Bases_de_datos.pdf")).toBeNull();
  });

  it("submits /api/documents only when user clicks Process & Analyze Document button", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentId: "doc-123", status: "ready" }),
    } as Response);

    render(
      <I18nProvider>
        <UploadPage />
      </I18nProvider>
    );

    const fileInput = screen.getByTestId("dropzone-file-input");
    const pdfFile = new File(["%PDF-1.4 dummy"], "Bases_de_datos.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    // Edit title
    const stagedTitleInput = screen.getByLabelText(/Document Title/i) as HTMLInputElement;
    fireEvent.change(stagedTitleInput, { target: { value: "Bases de Datos y SQL" } });

    // Click analyze button
    const analyzeBtn = screen.getByRole("button", { name: /Process & Analyze Document/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/documents", expect.objectContaining({
        method: "POST",
      }));
    });
  });
});
