"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { en, TranslationDict } from "./dictionaries/en";
import { es } from "./dictionaries/es";

export type Locale = "en" | "es";

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: TranslationDict;
  isSpanish: boolean;
}

const dictionaries: Record<Locale, TranslationDict> = { en, es };

const I18nContext = createContext<I18nContextValue | null>(null);

function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const saved = localStorage.getItem("socratic_locale");
    if (saved === "es" || saved === "en") return saved;
  } catch {
    // LocalStorage blocked
  }
  if (typeof navigator !== "undefined" && navigator.language) {
    if (navigator.language.toLowerCase().startsWith("es")) {
      return "es";
    }
  }
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const detected = detectBrowserLocale();
    setLocaleState(detected);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("socratic_locale", newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // LocalStorage blocked
    }
  };

  const dict = useMemo(() => dictionaries[locale] || en, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      dict,
      isSpanish: locale === "es",
    }),
    [locale, dict]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // Safe SSR / test fallback when rendered outside provider
    return {
      locale: "en",
      setLocale: () => {},
      dict: en,
      isSpanish: false,
    };
  }
  return context;
}
