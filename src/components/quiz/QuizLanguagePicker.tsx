"use client";

import React from "react";
import { Languages, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export type QuizLanguage = "auto" | "en" | "es";

export interface QuizLanguagePickerProps {
  value: QuizLanguage;
  onChange: (language: QuizLanguage) => void;
  disabled?: boolean;
}

export function QuizLanguagePicker({
  value,
  onChange,
  disabled = false,
}: QuizLanguagePickerProps) {
  const { dict } = useI18n();

  const options: { value: QuizLanguage; label: string; icon: string }[] = [
    { value: "auto", label: dict.quiz.langAuto, icon: "🌐" },
    { value: "es", label: dict.quiz.langEs, icon: "🇪🇸" },
    { value: "en", label: dict.quiz.langEn, icon: "🇬🇧" },
  ];

  const targetLangLabel = value === "es" ? dict.quiz.langEs : dict.quiz.langEn;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-primary" />
          <span>{dict.quiz.languageTitle}</span>
        </label>
        <span className="text-[11px] text-muted-foreground">
          {dict.quiz.languageSubtitle}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-all text-center select-none truncate flex items-center justify-center gap-1.5 ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "border-border bg-background hover:bg-muted/50 text-foreground"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {value !== "auto" && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
          <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {dict.quiz.crossLanguageNotice.replace("{language}", targetLangLabel)}
          </p>
        </div>
      )}
    </div>
  );
}
