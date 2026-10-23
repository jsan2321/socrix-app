"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTiming } from "@/lib/animations";
import { useI18n } from "@/lib/i18n/context";
import type { ConfidenceTracerData, ConfidenceTracerPoint } from "@/lib/confidence/tracer";

export interface ConfidenceTracerChartProps {
  data: ConfidenceTracerData;
  className?: string;
}

export function ConfidenceTracerChart({
  data,
  className = "",
}: ConfidenceTracerChartProps) {
  const { points } = data;
  const reduceMotion = useReducedMotion();
  const { dict } = useI18n();

  if (points.length === 0) {
    return (
      <div className={`p-8 text-center text-xs text-muted-foreground bg-card rounded-xl border border-border shadow-sm ${className}`}>
        {dict.results.noResponses}
      </div>
    );
  }

  const width = 600;
  const height = 220;
  const paddingX = 45;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const pointCoords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : paddingX + (idx / (points.length - 1)) * chartWidth;
    // Map confidenceLevel 1-5 to SVG Y (5 = top, 1 = bottom)
    const y = paddingTop + (1 - (p.confidenceLevel - 1) / 4) * chartHeight;
    return { ...p, x, y, index: idx + 1 };
  });

  const pathD = pointCoords.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  return (
    <div className={`space-y-4 ${className}`} data-testid="confidence-tracer-chart-container">
      {/* SVG Visualization */}
      <div className="relative border border-border bg-card rounded-xl p-4 overflow-x-auto shadow-sm">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-64 select-none"
          role="img"
          aria-label="Confidence Tracer Chart plotting confidence levels and correctness over questions"
        >
          {/* Background grid lines for levels 1 to 5 */}
          {[1, 2, 3, 4, 5].map((lvl) => {
            const y = paddingTop + (1 - (lvl - 1) / 4) * chartHeight;
            return (
              <g key={lvl}>
                <line
                  x1={paddingX - 10}
                  y1={y}
                  x2={width - paddingX + 10}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 18}
                  y={y + 4}
                  fill="currentColor"
                  fontSize="11"
                  textAnchor="end"
                  className="font-mono font-medium text-muted-foreground fill-current"
                >
                  L{lvl}
                </text>
              </g>
            );
          })}

          {/* Line connecting points */}
          {pointCoords.length > 1 && (
            <motion.path
              d={pathD}
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.28 }}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points */}
          {pointCoords.map((pt) => {
            const isCorrect = pt.correct;
            const strokeColor = isCorrect ? "#10b981" : "#ef4444";
            const fillColor = isCorrect ? "#059669" : "#dc2626";

            return (
              <g key={pt.index} className="cursor-pointer group">
                <title>{`Question ${pt.index}: ${pt.questionConcept}\nStated Confidence: Level ${pt.confidenceLevel}\nOutcome: ${pt.correct ? "Correct" : "Incorrect"}\nEvidence Viewed: ${pt.usedEvidence ? "Yes" : "No"}`}</title>
                {/* Evidence Used halo */}
                {pt.usedEvidence && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="12"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="motion-safe:animate-pulse"
                  />
                )}

                {/* Point Node */}
                <motion.circle
                  cx={pt.x}
                  cy={pt.y}
                  r="7"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...motionTiming, delay: reduceMotion ? 0 : pt.index * 0.06 }}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth="2"
                />

                {/* Point Number */}
                <text
                  x={pt.x}
                  y={pt.y + 4}
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {pt.index}
                </text>

                {/* X-axis concept label */}
                <text
                  x={pt.x}
                  y={height - 12}
                  fill="currentColor"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono text-muted-foreground fill-current"
                >
                  Q{pt.index}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Visual Chart Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-3 border-t border-border/60 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-emerald-500 inline-block" />
            <span>{dict.results.legendCorrect}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-rose-500 inline-block" />
            <span>{dict.results.legendIncorrect}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-dashed border-amber-500 inline-block" />
            <span>{dict.results.legendEvidence}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-primary rounded inline-block" />
            <span>{dict.results.legendTrajectory}</span>
          </div>
        </div>
      </div>

      {/* Actionable Learning Takeaways & Metacognitive Patterns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-lg border border-border bg-card shadow-sm space-y-1">
          <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span>{dict.results.chartTakeawayRetainedTitle}</span>
          </p>
          <p className="text-base font-serif font-bold text-foreground">
            {points.filter((p) => p.correct).length} / {points.length}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {dict.results.chartTakeawayRetainedDesc}
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-border bg-card shadow-sm space-y-1">
          <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
            <span>{dict.results.chartTakeawayBlindSpotsTitle}</span>
          </p>
          <p className="text-base font-serif font-bold text-foreground">
            {points.filter((p) => p.confidenceLevel >= 4 && !p.correct).length}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {dict.results.chartTakeawayBlindSpotsDesc}
          </p>
        </div>

        <div className="p-3.5 rounded-lg border border-border bg-card shadow-sm space-y-1">
          <p className="text-muted-foreground font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-600 inline-block" />
            <span>{dict.results.chartTakeawayEvidenceTitle}</span>
          </p>
          <p className="text-base font-serif font-bold text-foreground">
            {points.filter((p) => p.usedEvidence).length}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {dict.results.chartTakeawayEvidenceDesc}
          </p>
        </div>
      </div>

      {/* Screen Reader Accessible Table Summary (AC-CONF-4a) */}
      <div className="sr-only">
        <h3>Confidence Tracer Table Summary</h3>
        <table>
          <caption>Summary of Confidence Levels and Accuracy per Question</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Concept</th>
              <th scope="col">Confidence (1-5)</th>
              <th scope="col">Result</th>
              <th scope="col">Evidence Viewed</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p: ConfidenceTracerPoint, idx: number) => (
              <tr key={idx}>
                <td>Q{idx + 1}</td>
                <td>{p.questionConcept}</td>
                <td>{p.confidenceLevel}</td>
                <td>{p.correct ? "Correct" : "Incorrect"}</td>
                <td>{p.usedEvidence ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
