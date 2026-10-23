"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";

export interface ConfidenceSelectorProps {
  value: number | null;
  onChange: (confidence: number) => void;
  disabled?: boolean;
  className?: string;
}

const EMOJIS: Record<number, string> = {
  1: "🎲",
  2: "🤔",
  3: "⚖️",
  4: "💪",
  5: "🎯",
};

export function ConfidenceSelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: ConfidenceSelectorProps) {
  const { dict } = useI18n();

  const confidenceLevels = [
    { level: 1, label: dict.confidence.l1, emoji: EMOJIS[1] },
    { level: 2, label: dict.confidence.l2, emoji: EMOJIS[2] },
    { level: 3, label: dict.confidence.l3, emoji: EMOJIS[3] },
    { level: 4, label: dict.confidence.l4, emoji: EMOJIS[4] },
    { level: 5, label: dict.confidence.l5, emoji: EMOJIS[5] },
  ];
  return (
    <fieldset
      className={`space-y-2 border border-border bg-card/60 p-4 rounded-xl shadow-sm ${className}`}
      data-testid="confidence-selector-container"
    >
      <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
        {dict.confidence.title} <span className="text-amber-700 dark:text-amber-300 font-semibold">{dict.confidence.required}</span>
      </legend>

      <div className="grid grid-cols-5 gap-2 pt-1">
        {confidenceLevels.map(({ level, label, emoji }) => {
          const isSelected = value === level;
          return (
            <label
              key={level}
              htmlFor={`confidence-option-${level}`}
              onClick={() => {
                if (!disabled) {
                  onChange(level);
                }
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors motion-safe:transition-transform motion-safe:duration-200 cursor-pointer min-h-[44px] select-none ${
                isSelected
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-500/40 shadow-sm motion-safe:scale-[1.03]"
                  : "border-border bg-background/50 hover:border-border/80 text-foreground"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input
                type="radio"
                id={`confidence-option-${level}`}
                name="confidence-level"
                value={level}
                checked={isSelected}
                onChange={() => !disabled && onChange(level)}
                disabled={disabled}
                className="sr-only"
              />
              <span className="text-lg leading-none">{emoji}</span>
              <span className="text-xs font-bold mt-1 text-foreground">{level}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[60px]">
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
