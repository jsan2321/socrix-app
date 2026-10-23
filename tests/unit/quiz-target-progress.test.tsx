import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { getAdaptivePresets, SessionLengthPicker } from "@/components/quiz/SessionLengthPicker";
import { I18nProvider } from "@/lib/i18n/context";

const testDict = {
  presetQuick: "{count} questions · Quick",
  presetStandard: "{count} questions · Standard",
  presetDeep: "{count} questions · Deep Dive",
  presetAll: "All {count} concepts",
};

describe("Adaptive Question Target & Session Length", () => {
  describe("getAdaptivePresets calculation", () => {
    it("handles minimal 1-chunk documents safely", () => {
      const presets = getAdaptivePresets(1, testDict);
      expect(presets).toHaveLength(1);
      expect(presets[0]).toEqual({ value: 1, label: "All 1 concepts" });
    });

    it("handles short documents (3 chunks) with tailored 1, 2, All (3) options", () => {
      const presets = getAdaptivePresets(3, testDict);
      expect(presets).toHaveLength(3);
      expect(presets[0]).toEqual({ value: 1, label: "1" });
      expect(presets[1]).toEqual({ value: 2, label: "2" });
      expect(presets[2]).toEqual({ value: 3, label: "All 3 concepts" });
    });

    it("handles medium documents (5 chunks) with quick, standard, and all", () => {
      const presets = getAdaptivePresets(5, testDict);
      expect(presets).toHaveLength(3);
      expect(presets[0]).toEqual({ value: 3, label: "3 questions · Quick" });
      expect(presets[1]).toEqual({ value: 5, label: "5 questions · Standard" });
      expect(presets[2]).toEqual({ value: 5, label: "All 5 concepts" });
    });

    it("handles large documents (21 pages / 79 chunks) with full suite of presets", () => {
      const presets = getAdaptivePresets(79, testDict);
      expect(presets).toHaveLength(4);
      expect(presets[0]).toEqual({ value: 5, label: "5 questions · Quick" });
      expect(presets[1]).toEqual({ value: 10, label: "10 questions · Standard" });
      expect(presets[2]).toEqual({ value: 20, label: "20 questions · Deep Dive" });
      expect(presets[3]).toEqual({ value: 79, label: "All 79 concepts" });
    });
  });

  describe("SessionLengthPicker component", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("renders all preset buttons and triggers onChange on selection", () => {
      const onChange = vi.fn();
      render(
        <I18nProvider>
          <SessionLengthPicker
            totalChunks={79}
            value={5}
            onChange={onChange}
          />
        </I18nProvider>
      );

      expect(screen.getByText("Session Length")).toBeTruthy();
      expect(screen.getByText("How many questions would you like to answer?")).toBeTruthy();

      const quickBtn = screen.getByRole("button", { name: /5 questions · quick/i });
      const standardBtn = screen.getByRole("button", { name: /10 questions · standard/i });
      const deepBtn = screen.getByRole("button", { name: /20 questions · deep dive/i });
      const allBtn = screen.getByRole("button", { name: /all 79 concepts/i });

      expect(quickBtn).toBeTruthy();
      expect(standardBtn).toBeTruthy();
      expect(deepBtn).toBeTruthy();
      expect(allBtn).toBeTruthy();

      fireEvent.click(standardBtn);
      expect(onChange).toHaveBeenCalledWith(10);
    });

    it("renders friendly short-document notice for small texts (totalChunks <= 3)", () => {
      render(
        <I18nProvider>
          <SessionLengthPicker
            totalChunks={3}
            value={3}
            onChange={vi.fn()}
          />
        </I18nProvider>
      );

      expect(
        screen.getByText(/this short excerpt covers 3 core concepts/i)
      ).toBeTruthy();
    });

    it("does not render short-document notice for documents with > 3 chunks", () => {
      render(
        <I18nProvider>
          <SessionLengthPicker
            totalChunks={25}
            value={5}
            onChange={vi.fn()}
          />
        </I18nProvider>
      );

      expect(
        screen.queryByText(/this short excerpt covers/i)
      ).toBeNull();
    });

    it("renders properly in Spanish locale", () => {
      localStorage.setItem("socratic_locale", "es");
      render(
        <I18nProvider>
          <SessionLengthPicker
            totalChunks={3}
            value={3}
            onChange={vi.fn()}
          />
        </I18nProvider>
      );

      expect(screen.getByText(/duración de la sesión/i)).toBeTruthy();
      expect(screen.getByText(/cuántas preguntas/i)).toBeTruthy();
      expect(
        screen.getByText(/este breve texto cubre 3 conceptos/i)
      ).toBeTruthy();
    });
  });
});
