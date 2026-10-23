import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import React from "react";
import { I18nProvider, useI18n } from "@/lib/i18n/context";
import { LanguageToggle } from "@/components/theme/LanguageToggle";
import { HeaderBrand } from "@/components/navigation/HeaderBrand";
import { AppFooter } from "@/components/navigation/AppFooter";
import { ConfidenceGapAlert } from "@/components/results/ConfidenceGapAlert";
import { Dropzone } from "@/components/upload/Dropzone";
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

function ConsumerComponent() {
  const { locale, dict, isSpanish } = useI18n();
  return (
    <div>
      <span data-testid="current-locale">{locale}</span>
      <span data-testid="is-spanish">{String(isSpanish)}</span>
      <span data-testid="dashboard-text">{dict.nav.dashboard}</span>
      <span data-testid="quiz-title">{dict.quiz.title}</span>
    </div>
  );
}

describe("i18n Bilingual Support", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("ensures full key parity between English and Spanish dictionaries", () => {
    function getKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.entries(obj).flatMap(([k, v]) => {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null) {
          return getKeys(v as Record<string, unknown>, fullKey);
        }
        return [fullKey];
      });
    }

    const enKeys = getKeys(en);
    const esKeys = getKeys(es);

    // Every key in en must exist in es
    for (const key of enKeys) {
      expect(esKeys, `Missing key in Spanish dictionary: ${key}`).toContain(key);
    }

    // Every key in es must exist in en
    for (const key of esKeys) {
      expect(enKeys, `Missing key in English dictionary: ${key}`).toContain(key);
    }
  });

  it("defaults to English when navigator.language is English or non-Spanish", () => {
    Object.defineProperty(window.navigator, "language", {
      value: "en-US",
      configurable: true,
    });

    render(
      <I18nProvider>
        <ConsumerComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByTestId("is-spanish").textContent).toBe("false");
    expect(screen.getByTestId("dashboard-text").textContent).toBe("Dashboard");
    expect(screen.getByTestId("quiz-title").textContent).toBe("Source Cross-Examination");
  });

  it("auto-detects Spanish on first visit when navigator.language starts with es", () => {
    Object.defineProperty(window.navigator, "language", {
      value: "es-ES",
      configurable: true,
    });

    render(
      <I18nProvider>
        <ConsumerComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId("current-locale").textContent).toBe("es");
    expect(screen.getByTestId("is-spanish").textContent).toBe("true");
    expect(screen.getByTestId("dashboard-text").textContent).toBe("Panel");
    expect(screen.getByTestId("quiz-title").textContent).toBe("Contrainterrogatorio de Fuente");
  });

  it("respects saved locale preference from localStorage over navigator.language", () => {
    localStorage.setItem("socratic_locale", "es");
    Object.defineProperty(window.navigator, "language", {
      value: "en-US",
      configurable: true,
    });

    render(
      <I18nProvider>
        <ConsumerComponent />
      </I18nProvider>
    );

    expect(screen.getByTestId("current-locale").textContent).toBe("es");
    expect(screen.getByTestId("dashboard-text").textContent).toBe("Panel");
  });

  it("toggles between English and Spanish via LanguageToggle and persists preference", () => {
    Object.defineProperty(window.navigator, "language", {
      value: "en-US",
      configurable: true,
    });

    render(
      <I18nProvider>
        <ConsumerComponent />
        <LanguageToggle />
      </I18nProvider>
    );

    expect(screen.getByTestId("current-locale").textContent).toBe("en");

    // Click toggle to switch to Spanish
    const toggleBtn = screen.getByRole("button", { name: /cambiar a español/i });
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("current-locale").textContent).toBe("es");
    expect(screen.getByTestId("dashboard-text").textContent).toBe("Panel");
    expect(localStorage.getItem("socratic_locale")).toBe("es");

    // Click toggle to switch back to English
    const toggleBtnEn = screen.getByRole("button", { name: /switch to english/i });
    fireEvent.click(toggleBtnEn);

    expect(screen.getByTestId("current-locale").textContent).toBe("en");
    expect(screen.getByTestId("dashboard-text").textContent).toBe("Dashboard");
    expect(localStorage.getItem("socratic_locale")).toBe("en");
  });

  it("renders HeaderBrand and AppFooter in Spanish when Spanish locale is active", () => {
    localStorage.setItem("socratic_locale", "es");

    render(
      <I18nProvider>
        <HeaderBrand />
        <AppFooter />
      </I18nProvider>
    );

    expect(screen.getByText("Socrix")).toBeDefined();
    expect(screen.getByText("Contrainterrogador Socrático")).toBeDefined();
    expect(screen.getByText("Plataforma de Práctica de Recuperación Basada en Fuentes")).toBeDefined();
    expect(screen.getByText("Construido con Next.js 16, Supabase y pgvector")).toBeDefined();
  });

  it("renders ConfidenceGapAlert in Spanish when Spanish locale is active", () => {
    localStorage.setItem("socratic_locale", "es");

    render(
      <I18nProvider>
        <ConfidenceGapAlert />
      </I18nProvider>
    );

    expect(screen.getByText("Discrepancia entre Confianza y Precisión Detectada")).toBeDefined();
    expect(screen.getByText(/Tus respuestas recientes muestran una discrepancia significativa/i)).toBeDefined();
  });

  it("renders Dropzone prompts and validation errors in Spanish when Spanish locale is active", () => {
    localStorage.setItem("socratic_locale", "es");

    render(
      <I18nProvider>
        <Dropzone onFileSelected={() => {}} />
      </I18nProvider>
    );

    expect(screen.getByText("Arrastra y suelta tu material de estudio en PDF")).toBeDefined();
    expect(screen.getByText("Haz clic o presiona Enter para explorar archivos")).toBeDefined();

    // Trigger invalid file
    const fileInput = screen.getByTestId("dropzone-file-input");
    const badFile = new File(["dummy content"], "test.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(screen.getByText("Formato de archivo inválido. Solo se admiten archivos PDF con texto extraíble.")).toBeDefined();
  });
});
