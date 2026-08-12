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
  isCorrectAnswer?: boolean | null; // null = pre-submit, true/false = submitted result state
  onToggle: (statementId: string) => void;
  className?: string;
}

export function StatementCard({
  statementId,
  text,
  mode,
  selected,
  disabled = false,
  isCorrectAnswer = null,
  onToggle,
  className = "",
}: StatementCardProps) {
  const isRadio = mode === "identify_truth";

  const handleClick = () => {
    if (!disabled) {
      onToggle(statementId);
    }
  };

  // Determine border and background styles based on selection and post-submit correctness
  let containerStyle =
    "border-slate-800 bg-slate-950/40 hover:border-indigo-500/40 text-slate-200";

  if (isCorrectAnswer === true) {
    containerStyle = "border-emerald-500/60 bg-emerald-500/10 text-emerald-100 font-medium";
  } else if (isCorrectAnswer === false) {
    containerStyle = "border-red-500/60 bg-red-500/10 text-red-100";
  } else if (selected) {
    containerStyle = "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/40 text-slate-100 font-medium";
  }

  return (
    <Card
      onClick={handleClick}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-3 min-h-[44px] ${containerStyle} ${
        disabled ? "cursor-default" : ""
      } ${className}`}
      data-testid={`statement-card-${statementId}`}
    >
      <div className="mt-0.5 flex-shrink-0">
        <input
          type={isRadio ? "radio" : "checkbox"}
          id={`stmt-input-${statementId}`}
          checked={selected}
          onChange={() => {}} // handled by parent onClick
          disabled={disabled}
          className={`h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-700 ${
            isRadio ? "rounded-full" : "rounded"
          }`}
        />
      </div>

      <div className="flex-1 space-y-1">
        <label
          htmlFor={`stmt-input-${statementId}`}
          className="text-sm leading-relaxed block cursor-pointer"
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
