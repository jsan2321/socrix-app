"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/context";

export interface ConfidenceGapAlertProps {
  className?: string;
}

export function ConfidenceGapAlert({ className = "" }: ConfidenceGapAlertProps) {
  const { dict } = useI18n();

  return (
    <Alert
      variant="warning"
      className={`border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 ${className}`}
      data-testid="confidence-gap-alert-banner"
    >
      <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <AlertTitle className="text-sm font-serif font-bold text-amber-900 dark:text-amber-300">
          {dict.results.confidenceGapAlertTitle}
        </AlertTitle>
        <AlertDescription className="text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/90">
          {dict.results.confidenceGapAlertBody}
        </AlertDescription>
      </div>
    </Alert>
  );
}
