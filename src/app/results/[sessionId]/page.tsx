"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Award,
  Target,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Share2,
  Printer,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { ConfidenceGapAlert } from "@/components/results/ConfidenceGapAlert";
import { AnimatedCount } from "@/components/results/AnimatedCount";
import { ShareModal } from "@/components/results/ShareModal";
import { slideIn, motionTiming } from "@/lib/animations";
import { useI18n } from "@/lib/i18n/context";
import type { SessionResultsResponse } from "@/schemas/api";

const ConfidenceTracerChart = dynamic(
  () =>
    import("@/components/results/ConfidenceTracerChart").then(
      (mod) => mod.ConfidenceTracerChart
    ),
  {
    loading: () => (
      <div className="h-64 flex items-center justify-center border border-border bg-card rounded-xl">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    ),
  }
);

interface ResultsPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const { sessionId } = use(params);
  const { dict } = useI18n();
  const reduceMotion = useReducedMotion();
  const [results, setResults] = useState<SessionResultsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

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
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">{dict.common.loading}</p>
      </div>
    );
  }

  if (errorMessage || !results) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="bg-destructive/5 border-destructive/30">
          <CardHeader>
            <CardTitle className="text-lg font-serif font-bold text-foreground">{dict.common.error}</CardTitle>
            <CardDescription className="text-destructive">
              {errorMessage || dict.common.error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/upload">
              <Button>
                {dict.results.studyAnother}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accuracyPct = Math.round(results.accuracy * 100);
  const correctCount = Math.round(results.accuracy * results.totalAnswered);

  // Compute domain diagnostic assessments
  const points = results.confidenceTracer.points;
  const blindSpotsCount = points.filter((p) => p.confidenceLevel >= 4 && !p.correct).length;
  const hiddenStrengthsCount = points.filter((p) => p.confidenceLevel <= 2 && p.correct).length;

  const rollingGap = results.confidenceTracer.rollingGap;
  let calibrationLabel = dict.results.spotOnAlignment;
  let calibrationDescription = dict.results.spotOnAlignmentDesc;
  let calibrationVariant: "default" | "secondary" | "destructive" = "default";
  if (rollingGap > 0.35) {
    calibrationLabel = dict.results.calibrationGap;
    calibrationDescription = dict.results.calibrationGapDesc;
    calibrationVariant = "destructive";
  } else if (rollingGap > 0.2) {
    calibrationLabel = dict.results.goodAlignment;
    calibrationDescription = dict.results.goodAlignmentDesc;
    calibrationVariant = "secondary";
  }

  const getQuestionDiagnosticBadge = (correct: boolean, confidence: number) => {
    if (correct) {
      if (confidence >= 4) {
        return (
          <Badge className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{dict.results.diagnosticMastered}</span>
          </Badge>
        );
      }
      return (
        <Badge className="bg-sky-700 hover:bg-sky-800 text-white text-[11px] gap-1">
          <Sparkles className="w-3 h-3" />
          <span>{dict.results.diagnosticHiddenStrength}</span>
        </Badge>
      );
    }
    if (confidence >= 4) {
      return (
        <Badge className="bg-amber-800 hover:bg-amber-900 text-white text-[11px] gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>{dict.results.diagnosticBlindSpot}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-[11px] gap-1">
        <XCircle className="w-3 h-3" />
        <span>{dict.results.diagnosticNeedsReview}</span>
      </Badge>
    );
  };

  const getCertaintyWord = (level: number) => {
    switch (Math.round(level)) {
      case 1:
        return dict.confidence.l1;
      case 2:
        return dict.confidence.l2;
      case 3:
        return dict.confidence.l3;
      case 4:
        return dict.confidence.l4;
      case 5:
        return dict.confidence.l5;
      default:
        return `${dict.quiz.levelLabel} ${level}`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-4">
      {/* Title Header with Share Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2 text-center sm:text-left">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              {dict.results.badge}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground border-border">
              {results.documentTitle}
            </Badge>
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">
            {dict.results.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {results.totalAnswered} {dict.results.conceptsRetained.toLowerCase()}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 justify-center sm:justify-end no-print">
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsShareOpen(true)}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>{dict.results.shareResults}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2 border-border text-foreground hover:bg-secondary"
            title={dict.results.printDossier}
          >
            <Printer className="w-4 h-4 text-primary" />
            <span className="hidden sm:inline">{dict.results.printDossier}</span>
          </Button>
        </div>
      </div>

      {/* Summary Score Cards with Ubiquitous Learning Language */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Mastery Score */}
        <motion.div initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={motionTiming}>
          <Card className="bg-card border-border shadow-sm print-avoid-break">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{dict.results.masteryScore}</p>
                <p className="text-2xl font-serif font-bold text-foreground">
                  <AnimatedCount value={accuracyPct} format={(value) => `${Math.round(value)}%`} />
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {correctCount} / {results.totalAnswered} {dict.results.conceptsRetained.toLowerCase()}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card 2: Self-Awareness Alignment */}
        <motion.div initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={{ ...motionTiming, delay: reduceMotion ? 0 : 0.05 }}>
          <Card className="bg-card border-border shadow-sm print-avoid-break">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">{dict.results.selfAwareness}</p>
                <Badge variant={calibrationVariant} className="text-xs font-semibold px-2 py-0.5">
                  {calibrationLabel}
                </Badge>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {calibrationDescription}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Card 3: Metacognitive Diagnostic Balance */}
        <motion.div initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={{ ...motionTiming, delay: reduceMotion ? 0 : 0.1 }}>
          <Card className="bg-card border-border shadow-sm print-avoid-break">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center text-secondary-foreground flex-shrink-0">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Diagnostic Balance</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {blindSpotsCount} {dict.results.diagnosticBlindSpot}{blindSpotsCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                    {hiddenStrengthsCount} {dict.results.diagnosticHiddenStrength}{hiddenStrengthsCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {points.filter((p) => p.usedEvidence).length} {dict.results.sourcesConsulted.toLowerCase()}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Confidence Gap Alert Banner */}
      {results.confidenceGapAlert && <ConfidenceGapAlert />}

      {/* Confidence Tracer Chart Component */}
      <Card className="bg-card border-border shadow-sm print-avoid-break">
        <CardHeader>
          <CardTitle className="text-lg font-serif font-bold text-card-foreground">{dict.results.chartTitle}</CardTitle>
          <CardDescription className="text-muted-foreground text-xs">
            {dict.results.chartDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfidenceTracerChart data={results.confidenceTracer} />
        </CardContent>
      </Card>

      {/* Per-Question Review List with Diagnostic Badges */}
      {results.confidenceTracer.points.length > 0 && (
        <Card className="bg-card border-border shadow-sm print-avoid-break">
          <CardHeader>
            <CardTitle className="text-lg font-serif font-bold text-card-foreground">{dict.results.breakdownTitle}</CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              {dict.results.breakdownDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.confidenceTracer.points.map((pt, idx) => (
              <motion.div
                key={idx}
                initial={reduceMotion ? false : "hidden"}
                animate="visible"
                variants={slideIn}
                transition={{ ...motionTiming, delay: reduceMotion ? 0 : Math.min(idx * 0.04, 0.2) }}
                className="p-3.5 rounded-lg border border-border bg-background/50 hover:bg-muted/30 transition-colors flex items-center justify-between flex-wrap gap-3 text-xs print-avoid-break"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground font-bold">Q{idx + 1}</span>
                  <div>
                    <p className="font-serif font-medium text-foreground">{pt.questionConcept}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {dict.results.statedConfidence}: <span className="font-semibold text-foreground">{getCertaintyWord(pt.confidenceLevel)}</span> ({dict.quiz.levelLabel} {pt.confidenceLevel})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {pt.usedEvidence && (
                    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/30">
                      {dict.results.viewedEvidence}
                    </Badge>
                  )}
                  {getQuestionDiagnosticBadge(pt.correct, pt.confidenceLevel)}
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-start gap-4 pt-2 no-print">
        <Link href="/upload">
          <Button variant="outline" className="gap-2 border-border text-foreground hover:bg-secondary">
            <RotateCcw className="w-4 h-4" />
            <span>{dict.results.studyAnother}</span>
          </Button>
        </Link>
      </div>

      {/* Share Modal Dialog */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        sessionId={results.sessionId}
        documentTitle={results.documentTitle}
        masteryPercentage={accuracyPct}
        totalAnswered={results.totalAnswered}
        correctCount={correctCount}
        calibrationLabel={calibrationLabel}
        blindSpotsCount={blindSpotsCount}
        hiddenStrengthsCount={hiddenStrengthsCount}
      />
    </div>
  );
}
