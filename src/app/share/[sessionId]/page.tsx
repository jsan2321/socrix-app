import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSessionById, getSessionAnswersWithQuestions } from "@/lib/db/sessions";
import { getDocumentById } from "@/lib/db/documents";
import { getSupabaseAdminClient } from "@/lib/db/client";
import { computeRollingGap } from "@/lib/confidence/gap";
import {
  buildSessionExportData,
  type RawAnswerForExport,
  type QuestionDiagnostic,
} from "@/lib/export/results-card";

interface SharePageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { sessionId } = await params;
  try {
    const session = await getSessionById(sessionId);
    const document = await getDocumentById(session.document_id);
    const answers = await getSessionAnswersWithQuestions(sessionId);
    const total = answers.length;
    const correct = answers.filter((a) => a.is_correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    return {
      title: `${document.title} (${pct}% Mastery) — Socratic Cross-Examiner`,
      description: `Study dossier for "${document.title}": ${pct}% mastery across ${total} concepts with Socratic Devil's Advocate cross-examination.`,
      openGraph: {
        title: `${document.title} — ${pct}% Mastery Dossier`,
        description: `Source-grounded calibration and retention results from Socratic Cross-Examiner.`,
        images: [`/api/sessions/${sessionId}/og`],
      },
      twitter: {
        card: "summary_large_image",
        title: `${document.title} — ${pct}% Mastery Dossier`,
        description: `Source-grounded calibration and retention results from Socratic Cross-Examiner.`,
        images: [`/api/sessions/${sessionId}/og`],
      },
    };
  } catch {
    return {
      title: "Study Dossier — Socratic Cross-Examiner",
      description: "Review source-grounded study session calibration and mastery results.",
    };
  }
}

export default async function PublicSharePage({ params }: SharePageProps) {
  const { sessionId } = await params;

  let sessionData;
  try {
    const session = await getSessionById(sessionId);
    const document = await getDocumentById(session.document_id);
    const answersWithConcepts = await getSessionAnswersWithQuestions(sessionId);

    const questionIds = Array.from(
      new Set(answersWithConcepts.map((a) => a.question_id))
    );

    const supabase = getSupabaseAdminClient();

    const { data: questionsData } =
      questionIds.length > 0
        ? await supabase
            .from("quiz_questions")
            .select("id, concept, grounding_chunk_ids")
            .in("id", questionIds)
        : { data: [] };

    const { data: statementsData } =
      questionIds.length > 0
        ? await supabase
            .from("quiz_statements")
            .select("id, question_id, text, is_true, grounding_rationale")
            .in("id", questionIds)
        : { data: [] };

    const chunkIds = Array.from(
      new Set(
        (questionsData ?? []).flatMap((q) => q.grounding_chunk_ids ?? [])
      )
    );

    const { data: chunksData } =
      chunkIds.length > 0
        ? await supabase
            .from("document_chunks")
            .select("id, heading, text")
            .in("id", chunkIds)
        : { data: [] };

    const chunkMap = new Map<string, string>();
    for (const chunk of chunksData ?? []) {
      const label = chunk.heading ? `${chunk.heading}: ` : "";
      chunkMap.set(chunk.id, `${label}${chunk.text}`.slice(0, 320));
    }

    const questionChunkMap = new Map<string, string[]>();
    for (const q of questionsData ?? []) {
      questionChunkMap.set(q.id, q.grounding_chunk_ids ?? []);
    }

    const rationaleMap = new Map<string, string>();
    for (const s of statementsData ?? []) {
      if (s.grounding_rationale) {
        rationaleMap.set(s.question_id, s.grounding_rationale);
      }
    }

    const rawAnswers: RawAnswerForExport[] = answersWithConcepts.map((a) => {
      const qChunkIds = questionChunkMap.get(a.question_id) ?? [];
      const excerpt = qChunkIds.length > 0 ? chunkMap.get(qChunkIds[0]) : null;

      return {
        id: a.id,
        question_id: a.question_id,
        is_correct: a.is_correct,
        confidence_level: a.confidence_level,
        evidence_viewed: a.evidence_viewed,
        answered_at: a.answered_at,
        concept: a.concept,
        grounding_rationale: rationaleMap.get(a.question_id) ?? null,
        source_excerpt: excerpt ?? null,
      };
    });

    const rollingGap = computeRollingGap(rawAnswers, 5);

    sessionData = buildSessionExportData({
      sessionId: session.id,
      documentTitle: document.title,
      createdAt: session.created_at,
      mode: session.mode,
      rollingGap,
      answers: rawAnswers,
    });
  } catch {
    notFound();
  }

  const { metrics, questions, documentTitle, formattedDate } = sessionData;

  const getDiagnosticBadge = (diag: QuestionDiagnostic) => {
    switch (diag) {
      case "mastered":
        return (
          <Badge className="bg-emerald-700 text-white gap-1 hover:bg-emerald-800 text-[11px]">
            <CheckCircle2 className="w-3 h-3" />
            <span>Mastered</span>
          </Badge>
        );
      case "blind_spot":
        return (
          <Badge className="bg-amber-800 text-white gap-1 hover:bg-amber-900 text-[11px]">
            <ShieldAlert className="w-3 h-3" />
            <span>Blind Spot</span>
          </Badge>
        );
      case "hidden_strength":
        return (
          <Badge className="bg-sky-600 text-white gap-1 hover:bg-sky-700 text-[11px]">
            <Sparkles className="w-3 h-3" />
            <span>Hidden Strength</span>
          </Badge>
        );
      case "needs_review":
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <XCircle className="w-3 h-3" />
            <span>Needs Review</span>
          </Badge>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 text-foreground">
      {/* Top Banner Header */}
      <div className="space-y-3 text-center sm:text-left">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            Public Study Dossier
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            Completed on {formattedDate}
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-foreground">
          {documentTitle}
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Source-grounded cross-examination results measuring retention and eliminating illusions of competence.
        </p>
      </div>

      {/* Ubiquitous Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tile 1: Mastery Score */}
        <Card className="bg-card border-border shadow-sm print-avoid-break">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Mastery Score</p>
              <p className="text-2xl font-serif font-bold text-foreground">
                {metrics.masteryPercentage}%
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.correctCount} of {metrics.totalAnswered} concepts retained
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tile 2: Self-Awareness Alignment */}
        <Card className="bg-card border-border shadow-sm print-avoid-break">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Self-Awareness</p>
              <p className="text-lg font-serif font-bold text-foreground">
                {metrics.calibrationLabel}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {metrics.calibrationDescription}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tile 3: Metacognitive Insights */}
        <Card className="bg-card border-border shadow-sm print-avoid-break">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Diagnostic Insights</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {metrics.blindSpotsCount} Blind Spot{metrics.blindSpotsCount === 1 ? "" : "s"}
                </span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {metrics.hiddenStrengthsCount} Hidden Strength{metrics.hiddenStrengthsCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {metrics.evidenceConsultedCount} source checks
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Concept Breakdown List */}
      <Card className="bg-card border-border shadow-sm print-avoid-break">
        <CardHeader>
          <CardTitle className="text-lg font-serif font-bold text-card-foreground">
            Concept-by-Concept Analysis
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Review of tested concepts, student certainty, and source-grounded excerpts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.index}
              className="p-4 rounded-xl border border-border bg-background/50 hover:bg-muted/20 transition-colors space-y-2.5 print-avoid-break"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    #{q.index}
                  </span>
                  <p className="text-sm font-serif font-semibold text-foreground">
                    {q.concept}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Certainty: <strong className="text-foreground">{q.certaintyLabel}</strong>
                  </span>
                  {getDiagnosticBadge(q.diagnostic)}
                </div>
              </div>

              {/* Rationale or Excerpt if available */}
              {(q.groundingRationale || q.sourceExcerpt) && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-primary" />
                    Source Grounding
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {q.groundingRationale || q.sourceExcerpt}
                  </p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Call to Action Banner (Invite recipient to practice) */}
      <Card className="bg-primary/5 border-primary/20 shadow-sm print-avoid-break no-print">
        <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-xl font-serif font-bold text-foreground">
              Test Your Own Mastery Against This Source
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Upload your own PDF chapter or paper and practice with Devil&apos;s Advocate Socratic cross-examination to uncover hidden blind spots and verify real retention.
            </p>
          </div>
          <Link href="/upload">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 whitespace-nowrap shadow-sm">
              <span>Start Cross-Examination</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
