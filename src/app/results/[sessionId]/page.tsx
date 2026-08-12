"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Award, Target, TrendingUp, RotateCcw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceTracerChart } from "@/components/results/ConfidenceTracerChart";
import { ConfidenceGapAlert } from "@/components/results/ConfidenceGapAlert";
import type { SessionResultsResponse } from "@/schemas/api";

interface ResultsPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = use(params);
  const [results, setResults] = useState<SessionResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/results`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to fetch session results.");
      }

      setResults(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading results.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
        <p className="text-sm text-slate-400">Loading performance evaluation & Confidence Tracer data…</p>
      </div>
    );
  }

  if (errorMessage || !results) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="bg-slate-900/80 border-red-500/30">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Unable to Load Results</CardTitle>
            <CardDescription className="text-red-300">
              {errorMessage || "Session results could not be retrieved."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/upload">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white">
                Return to Upload Page
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accuracyPct = Math.round(results.accuracy * 100);

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-4">
      {/* Title Header */}
      <div className="space-y-2 text-center sm:text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            Session Evaluation
          </Badge>
          <Badge variant="outline" className="text-slate-400 border-slate-800">
            {results.documentTitle}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Performance & Calibration</h1>
        <p className="text-xs text-slate-500 font-mono">Session ID: {results.sessionId}</p>
      </div>

      {/* Summary Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900/60 border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Overall Accuracy</p>
              <p className="text-2xl font-bold text-slate-100">{accuracyPct}%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Questions Answered</p>
              <p className="text-2xl font-bold text-slate-100">{results.totalAnswered}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Rolling Gap</p>
              <p className="text-2xl font-bold text-amber-400">
                {results.confidenceTracer.rollingGap}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confidence Gap Alert Banner */}
      {results.confidenceGapAlert && <ConfidenceGapAlert />}

      {/* Confidence Tracer Chart Component */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200">Confidence Tracer Chart</CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            Plots stated confidence level (1–5) against correctness across answered questions. Dotted rings indicate source evidence was viewed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfidenceTracerChart data={results.confidenceTracer} />
        </CardContent>
      </Card>

      {/* Per-Question Review List */}
      {results.confidenceTracer.points.length > 0 && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Question Breakdown</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Chronological log of concepts, stated confidence, and evidence usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.confidenceTracer.points.map((pt, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40 flex items-center justify-between flex-wrap gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-500 font-bold">Q{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-slate-200">{pt.questionConcept}</p>
                    <p className="text-[11px] text-slate-400">
                      Stated Confidence: <span className="font-bold text-amber-400">Level {pt.confidenceLevel}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {pt.usedEvidence && (
                    <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                      Viewed Evidence
                    </Badge>
                  )}

                  {pt.correct ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Correct</span>
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="bg-red-600 hover:bg-red-700 text-xs gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Incorrect</span>
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <Link href="/upload">
          <Button variant="outline" className="gap-2 border-slate-800 text-slate-300 hover:bg-slate-800">
            <RotateCcw className="w-4 h-4" />
            <span>Study Another Document</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
