import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  getLanguageInstruction,
  buildDevilsAdvocatePrompt,
  buildRepairPrompt,
} from "@/lib/ai/prompts/devils-advocate";
import { QuizLanguagePicker } from "@/components/quiz/QuizLanguagePicker";
import { I18nProvider } from "@/lib/i18n/context";

describe("Quiz Language Selection & Prompt Enforcement", () => {
  describe("getLanguageInstruction & Prompt Builders", () => {
    it("generates strict Spanish instructions when language is 'es'", () => {
      const instructions = getLanguageInstruction("es");
      expect(instructions.systemRule).toContain("ENTIRELY IN SPANISH");
      expect(instructions.userDirective).toContain("TARGET LANGUAGE: SPANISH");
      expect(instructions.repairReminder).toContain("SPANISH");

      const prompt = buildDevilsAdvocatePrompt("Concepto de Prueba", "intermediate", "Contexto", "es");
      expect(prompt.systemPrompt).toContain("ENTIRELY IN SPANISH");
      expect(prompt.userPrompt).toContain("TARGET LANGUAGE: SPANISH");

      const repair = buildRepairPrompt(prompt.userPrompt, ["Error de validación"], "es");
      expect(repair).toContain("SPANISH");
    });

    it("generates strict English instructions when language is 'en'", () => {
      const instructions = getLanguageInstruction("en");
      expect(instructions.systemRule).toContain("ENTIRELY IN ENGLISH");
      expect(instructions.userDirective).toContain("TARGET LANGUAGE: ENGLISH");
      expect(instructions.repairReminder).toContain("ENGLISH");

      const prompt = buildDevilsAdvocatePrompt("Test Concept", "foundational", "Context", "en");
      expect(prompt.systemPrompt).toContain("ENTIRELY IN ENGLISH");
      expect(prompt.userPrompt).toContain("TARGET LANGUAGE: ENGLISH");

      const repair = buildRepairPrompt(prompt.userPrompt, ["Validation issue"], "en");
      expect(repair).toContain("ENGLISH");
    });

    it("generates document-matching instructions when language is 'auto'", () => {
      const instructions = getLanguageInstruction("auto");
      expect(instructions.systemRule).toContain("Automatically detect the primary natural language");
      expect(instructions.userDirective).toContain("TARGET LANGUAGE: MATCH DOCUMENT DATA LANGUAGE");

      const prompt = buildDevilsAdvocatePrompt("Auto Concept", "advanced", "Context", "auto");
      expect(prompt.systemPrompt).toContain("Automatically detect");
      expect(prompt.userPrompt).toContain("MATCH DOCUMENT DATA LANGUAGE");
    });
  });

  describe("QuizLanguagePicker component", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("renders all 3 language options and triggers onChange when clicked", () => {
      const onChange = vi.fn();
      render(
        <I18nProvider>
          <QuizLanguagePicker value="auto" onChange={onChange} />
        </I18nProvider>
      );

      expect(screen.getByText("Practice Language")).toBeTruthy();
      expect(screen.getByText("Choose the language for questions and explanations")).toBeTruthy();

      const autoBtn = screen.getByRole("button", { name: /original \/ auto/i });
      const esBtn = screen.getByRole("button", { name: /spanish \(español\)/i });
      const enBtn = screen.getByRole("button", { name: /english/i });

      expect(autoBtn).toBeTruthy();
      expect(esBtn).toBeTruthy();
      expect(enBtn).toBeTruthy();

      fireEvent.click(esBtn);
      expect(onChange).toHaveBeenCalledWith("es");

      fireEvent.click(enBtn);
      expect(onChange).toHaveBeenCalledWith("en");
    });

    it("shows cross-language explanatory notice when explicit language is chosen", () => {
      const { rerender } = render(
        <I18nProvider>
          <QuizLanguagePicker value="auto" onChange={vi.fn()} />
        </I18nProvider>
      );

      expect(screen.queryByText(/source text is read in its original language/i)).toBeNull();

      rerender(
        <I18nProvider>
          <QuizLanguagePicker value="es" onChange={vi.fn()} />
        </I18nProvider>
      );

      expect(
        screen.getByText(/source text is read in its original language, and questions will be generated in spanish \(español\)/i)
      ).toBeTruthy();
    });

    it("renders properly in Spanish locale", () => {
      localStorage.setItem("socratic_locale", "es");
      render(
        <I18nProvider>
          <QuizLanguagePicker value="auto" onChange={vi.fn()} />
        </I18nProvider>
      );

      expect(screen.getByText("Idioma de Práctica")).toBeTruthy();
      expect(screen.getByText("Elige el idioma para las preguntas y explicaciones")).toBeTruthy();
      expect(screen.getByRole("button", { name: /original \/ automático/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /español/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /inglés/i })).toBeTruthy();
    });
  });
});
