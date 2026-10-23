"use client";

import { useI18n } from "@/lib/i18n/context";

export function AccuracyTrend({ values, label }: { values: number[]; label?: string }) {
  const { dict } = useI18n();
  const displayLabel = label ?? dict.dashboard.accuracyTrend;
  if (values.length === 0) return <p className="text-xs text-muted-foreground">{dict.dashboard.noCompletedSessions}</p>;
  const width = 120; const height = 32;
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - value * height}`).join(" ");
  return <div className="space-y-1"><svg role="img" aria-label={`${displayLabel}: ${values.map((value) => `${Math.round(value * 100)}%`).join(", ")}`} viewBox={`0 0 ${width} ${height}`} className="h-8 w-30 overflow-visible"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" vectorEffect="non-scaling-stroke" /></svg><p className="text-xs text-muted-foreground">{displayLabel}</p></div>;
}
