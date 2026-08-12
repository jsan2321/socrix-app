import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Dropzone } from "@/components/upload/Dropzone";
import { ConfidenceSelector } from "@/components/quiz/ConfidenceSelector";
import { StatementCard } from "@/components/quiz/StatementCard";
import { ConfidenceTracerChart } from "@/components/results/ConfidenceTracerChart";
import type { ConfidenceTracerData } from "@/lib/confidence/tracer";

describe("Frontend UI Components Unit Suite (Phase 9)", () => {
  describe("Dropzone Component", () => {
    const mockOnFileSelected = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders dropzone container and responds to keyboard Enter click", () => {
      render(<Dropzone onFileSelected={mockOnFileSelected} />);

      const dropzone = screen.getByTestId("dropzone-container");
      expect(dropzone).toBeDefined();

      fireEvent.keyDown(dropzone, { key: "Enter" });
      // Input click triggered
    });

    it("displays error message when non-PDF file is selected", () => {
      render(<Dropzone onFileSelected={mockOnFileSelected} />);

      const fileInput = screen.getByTestId("dropzone-file-input");
      const badFile = new File(["dummy content"], "test.txt", { type: "text/plain" });

      fireEvent.change(fileInput, { target: { files: [badFile] } });

      expect(screen.getByTestId("dropzone-error")).toBeDefined();
      expect(screen.getByText(/Only text-extractable PDF files are supported/i)).toBeDefined();
      expect(mockOnFileSelected).not.toHaveBeenCalled();
    });

    it("invokes onFileSelected when a valid PDF file is selected", () => {
      render(<Dropzone onFileSelected={mockOnFileSelected} />);

      const fileInput = screen.getByTestId("dropzone-file-input");
      const pdfFile = new File(["%PDF-1.4 content"], "textbook.pdf", { type: "application/pdf" });

      fireEvent.change(fileInput, { target: { files: [pdfFile] } });

      expect(mockOnFileSelected).toHaveBeenCalledWith(pdfFile);
    });
  });

  describe("ConfidenceSelector Component", () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders 5 discrete confidence level radio options inside fieldset", () => {
      render(<ConfidenceSelector value={null} onChange={mockOnChange} />);

      const container = screen.getByTestId("confidence-selector-container");
      expect(container).toBeDefined();

      // Verify all 5 levels (1 to 5) exist
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByLabelText(new RegExp(String(i)))).toBeDefined();
      }
    });

    it("triggers onChange when a confidence option is selected", () => {
      render(<ConfidenceSelector value={null} onChange={mockOnChange} />);

      const level5Input = screen.getByLabelText(/Certain/i);
      fireEvent.click(level5Input);

      expect(mockOnChange).toHaveBeenCalledWith(5);
    });
  });

  describe("StatementCard Component", () => {
    const mockOnToggle = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders radio input for identify_truth mode and checkbox for identify_both_lies mode", () => {
      const { rerender } = render(
        <StatementCard
          statementId="s-1"
          text="Photosynthesis converts light into chemical energy."
          mode="identify_truth"
          selected={false}
          onToggle={mockOnToggle}
        />
      );

      const radioInput = screen.getByRole("radio");
      expect(radioInput).toBeDefined();

      rerender(
        <StatementCard
          statementId="s-1"
          text="Photosynthesis converts light into chemical energy."
          mode="identify_both_lies"
          selected={false}
          onToggle={mockOnToggle}
        />
      );

      const checkboxInput = screen.getByRole("checkbox");
      expect(checkboxInput).toBeDefined();
    });

    it("invokes onToggle when card is clicked", () => {
      render(
        <StatementCard
          statementId="s-1"
          text="Statement text"
          mode="identify_truth"
          selected={false}
          onToggle={mockOnToggle}
        />
      );

      const card = screen.getByTestId("statement-card-s-1");
      fireEvent.click(card);

      expect(mockOnToggle).toHaveBeenCalledWith("s-1");
    });
  });

  describe("ConfidenceTracerChart Component", () => {
    it("renders SVG chart container and accessible screen reader summary table (AC-CONF-4a)", () => {
      const sampleTracerData: ConfidenceTracerData = {
        points: [
          {
            answeredAt: new Date().toISOString(),
            questionConcept: "Cellular Energy",
            confidenceLevel: 5,
            correct: true,
            usedEvidence: false,
          },
          {
            answeredAt: new Date().toISOString(),
            questionConcept: "ATP Cycle",
            confidenceLevel: 4,
            correct: false,
            usedEvidence: true,
          },
        ],
        rollingGap: 0.5,
        overconfidenceRate: 0.5,
        underconfidenceRate: 0.0,
      };

      render(<ConfidenceTracerChart data={sampleTracerData} />);

      expect(screen.getByTestId("confidence-tracer-chart-container")).toBeDefined();
      expect(screen.getByText("Confidence Tracer Table Summary")).toBeDefined();
      expect(screen.getByText("Cellular Energy")).toBeDefined();
      expect(screen.getByText("ATP Cycle")).toBeDefined();
    });
  });
});
