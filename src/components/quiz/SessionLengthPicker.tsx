"use client";

import React from "react";
import { Info, Target } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export interface SessionLengthPickerProps {
  totalChunks: number;
  value: number | null;
  onChange: (target: number | null) => void;
  disabled?: boolean;
}

interface PresetOption {
  value: number | null;
  label: string;
}

export function getAdaptivePresets(
  totalChunks: number,
  dict: {
    presetQuick: string;
    presetStandard: string;
    presetDeep: string;
    presetAll: string;
  }
): PresetOption[] {
  const safeChunks = Math.max(1, totalChunks);

  if (safeChunks <= 3) {
    const list: PresetOption[] = [];
    for (let i = 1; i < safeChunks; i++) {
      list.push({ value: i, label: `${i}` });
    }
    list.push({
      value: safeChunks,
      label: dict.presetAll.replace("{count}", String(safeChunks)),
    });
    return list;
  }

  if (safeChunks <= 7) {
    const list: PresetOption[] = [
      { value: 3, label: dict.presetQuick.replace("{count}", "3") },
    ];
    if (safeChunks >= 5) {
      list.push({ value: 5, label: dict.presetStandard.replace("{count}", "5") });
    }
    list.push({
      value: safeChunks,
      label: dict.presetAll.replace("{count}", String(safeChunks)),
    });
    return list;
  }

  // Large documents (e.g. 79 chunks)
  const list: PresetOption[] = [
    { value: 5, label: dict.presetQuick.replace("{count}", "5") },
    { value: 10, label: dict.presetStandard.replace("{count}", "10") },
  ];
  if (safeChunks >= 20) {
    list.push({ value: 20, label: dict.presetDeep.replace("{count}", "20") });
  }
  list.push({
    value: safeChunks,
    label: dict.presetAll.replace("{count}", String(safeChunks)),
  });

  return list;
}

export function SessionLengthPicker({
  totalChunks,
  value,
  onChange,
  disabled = false,
}: SessionLengthPickerProps) {
  const { dict } = useI18n();
  const presets = getAdaptivePresets(totalChunks, {
    presetQuick: dict.quiz.presetQuick,
    presetStandard: dict.quiz.presetStandard,
    presetDeep: dict.quiz.presetDeep,
    presetAll: dict.quiz.presetAll,
  });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span>{dict.quiz.sessionLengthTitle}</span>
        </label>
        <span className="text-[11px] text-muted-foreground">
          {dict.quiz.sessionLengthSubtitle}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {presets.map((preset, idx) => {
          const isSelected =
            value === preset.value ||
            (value === null && preset.value === totalChunks);

          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset.value)}
              className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-all text-center select-none truncate ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "border-border bg-background hover:bg-muted/50 text-foreground"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {totalChunks <= 3 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {dict.quiz.shortDocNotice.replace("{count}", String(totalChunks))}
          </p>
        </div>
      )}
    </div>
  );
}
