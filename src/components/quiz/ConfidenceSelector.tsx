"use client";

import React from "react";

export interface ConfidenceSelectorProps {
  value: number | null;
  onChange: (confidence: number) => void;
  disabled?: boolean;
  className?: string;
}

const CONFIDENCE_LEVELS = [
  { level: 1, label: "Just guessing", emoji: "🎲" },
  { level: 2, label: "Unsure", emoji: "🤔" },
  { level: 3, label: "Moderate", emoji: "⚖️" },
  { level: 4, label: "Confident", emoji: "💪" },
  { level: 5, label: "Certain", emoji: "🎯" },
];

export function ConfidenceSelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: ConfidenceSelectorProps) {
  return (
    <fieldset
      className={`space-y-2 border border-slate-800 bg-slate-950/40 p-4 rounded-xl ${className}`}
      data-testid="confidence-selector-container"
    >
      <legend className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
        State Your Confidence Level (1–5) <span className="text-amber-400">*Required</span>
      </legend>

      <div className="grid grid-cols-5 gap-2 pt-1">
        {CONFIDENCE_LEVELS.map(({ level, label, emoji }) => {
          const isSelected = value === level;
          return (
            <label
              key={level}
              htmlFor={`confidence-option-${level}`}
              className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer min-h-[44px] select-none ${
                isSelected
                  ? "border-amber-400 bg-amber-400/10 text-amber-300 font-semibold ring-1 ring-amber-400/40"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300"
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
              <span className="text-xs font-bold mt-1 text-slate-200">{level}</span>
              <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[60px]">
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
