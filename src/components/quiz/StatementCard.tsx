"use client";

import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface StatementCardProps {
  statementId: string;
  text: string;
  mode: "identify_truth" | "identify_both_lies";
  selected: boolean;
  disabled?: boolean;
  revealPercent?: number;
  isCorrectAnswer?: boolean | null; // null = pre-submit, true/false = submitted result state
  letter?: string;
  onToggle: (statementId: string) => void;
  className?: string;
}

export function StatementCard({
  statementId,
  text,
  mode,
  selected,
  disabled = false,
  revealPercent = 100,
  isCorrectAnswer = null,
  letter,
  onToggle,
  className = "",
}: StatementCardProps) {
  const isRadio = mode === "identify_truth";

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;

    const target = event.target as HTMLElement;
    if (target.closest("input, label")) return;

    onToggle(statementId);
  };

  // Determine border and background styles based on selection and post-submit correctness
  let containerStyle =
    "border-border bg-card/60 hover:border-primary/40 text-foreground";

  if (isCorrectAnswer === true) {
    containerStyle = "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 font-medium";
  } else if (isCorrectAnswer === false) {
    containerStyle = "border-destructive/60 bg-destructive/10 text-destructive font-medium";
  } else if (selected) {
    containerStyle = "border-primary bg-primary/10 text-foreground font-medium shadow-sm";
  }

  return (
    <Card
      onClick={handleClick}
      className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 min-h-[44px] ${containerStyle} ${
        disabled ? "cursor-default" : ""
      } ${className}`}
      data-testid={`statement-card-${statementId}`}
    >
      <div className="mt-0.5 flex items-center gap-2 flex-shrink-0">
        <input
          type={isRadio ? "radio" : "checkbox"}
          id={`stmt-input-${statementId}`}
          checked={selected}
          onChange={() => onToggle(statementId)}
          disabled={disabled}
          className={`h-4 w-4 accent-primary text-primary focus:ring-primary border-border ${
            isRadio ? "rounded-full" : "rounded"
          }`}
        />
        {letter && (
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-muted/80 text-muted-foreground border border-border/70 select-none">
            {letter}
          </kbd>
        )}
      </div>

      <div className="flex-1 space-y-1">
        <label
          htmlFor={`stmt-input-${statementId}`}
          className="text-sm leading-relaxed block cursor-pointer"
          style={{ clipPath: `inset(0 ${100 - revealPercent}% 0 0)` }}
        >
          {text}
        </label>
      </div>

      {isCorrectAnswer === true && (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      )}

      {isCorrectAnswer === false && (
        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
      )}
    </Card>
  );
}
