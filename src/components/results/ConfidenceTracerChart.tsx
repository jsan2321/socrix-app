"use client";

import React from "react";
import type { ConfidenceTracerData, ConfidenceTracerPoint } from "@/lib/confidence/tracer";

export interface ConfidenceTracerChartProps {
  data: ConfidenceTracerData;
  className?: string;
}

export function ConfidenceTracerChart({
  data,
  className = "",
}: ConfidenceTracerChartProps) {
  const { points, rollingGap, overconfidenceRate, underconfidenceRate } = data;

  if (points.length === 0) {
    return (
      <div className={`p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800 ${className}`}>
        No question responses recorded for this session yet.
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
      <div className="relative border border-slate-800 bg-slate-950/60 rounded-xl p-4 overflow-x-auto">
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
                  stroke="#334155"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 18}
                  y={y + 4}
                  fill="#94a3b8"
                  fontSize="11"
                  textAnchor="end"
                  className="font-mono font-medium"
                >
                  L{lvl}
                </text>
              </g>
            );
          })}

          {/* Line connecting points */}
          {pointCoords.length > 1 && (
            <path
              d={pathD}
              fill="none"
              stroke="#6366f1"
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
                    className="animate-pulse"
                  />
                )}

                {/* Point Node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="7"
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
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono"
                >
                  Q{pt.index}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Metric Rates Footer */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60">
          <p className="text-slate-400 font-medium">Rolling Mean Gap</p>
          <p className="text-sm font-bold text-indigo-400 mt-0.5">{rollingGap}</p>
        </div>
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60">
          <p className="text-slate-400 font-medium">Overconfidence Rate</p>
          <p className="text-sm font-bold text-amber-400 mt-0.5">
            {Math.round(overconfidenceRate * 100)}%
          </p>
        </div>
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60">
          <p className="text-slate-400 font-medium">Underconfidence Rate</p>
          <p className="text-sm font-bold text-purple-400 mt-0.5">
            {Math.round(underconfidenceRate * 100)}%
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
