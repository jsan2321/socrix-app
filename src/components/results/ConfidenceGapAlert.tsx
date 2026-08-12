"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  CONFIDENCE_GAP_ALERT_HEADER,
  CONFIDENCE_GAP_ALERT_COPY,
} from "@/lib/confidence/alert";

export interface ConfidenceGapAlertProps {
  className?: string;
}

export function ConfidenceGapAlert({ className = "" }: ConfidenceGapAlertProps) {
  return (
    <Alert
      variant="warning"
      className={`border-amber-500/40 bg-amber-500/10 text-amber-100 ${className}`}
      data-testid="confidence-gap-alert-banner"
    >
      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="space-y-1">
        <AlertTitle className="text-sm font-bold text-amber-300">
          {CONFIDENCE_GAP_ALERT_HEADER}
        </AlertTitle>
        <AlertDescription className="text-xs leading-relaxed text-amber-200/90">
          {CONFIDENCE_GAP_ALERT_COPY}
        </AlertDescription>
      </div>
    </Alert>
  );
}
