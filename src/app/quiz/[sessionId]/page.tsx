"use client";

import React, { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2, XCircle, ArrowRight, Award, Loader2, BookOpen, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatementCard } from "@/components/quiz/StatementCard";
import { ConfidenceSelector } from "@/components/quiz/ConfidenceSelector";
import { EvidencePanel } from "@/components/quiz/EvidencePanel";
import type { EvidenceResult } from "@/lib/rag/evidence";

interface QuizQuestion {
  questionId: string;
  concept: string;
  difficulty: "foundational" | "intermediate" | "advanced";
  statements: Array<{
    statementId: string;
    text: string;
  }>;
}

interface QuizPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function QuizPage({ params }: QuizPageProps) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [sessionMode, setSessionMode] = useState<"identify_truth" | "identify_both_lies">("identify_truth");
  const [excludeChunkIds, setExcludeChunkIds] = useState<string[]>([]);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState<number | null>(null);

  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean;
    correctStatementIds: string[];
  } | null>(null);

  const [evidence, setEvidence] = useState<EvidenceResult | null>(null);
  const [showOptionalEvidence, setShowOptionalEvidence] = useState(false);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

  const [questionNumber, setQuestionNumber] = useState(1);
  const [isExhausted, setIsExhausted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch next question from API
  const fetchQuestion = useCallback(async (excludes: string[]) => {
    setIsLoadingQuestion(true);
    setErrorMessage(null);
    setAnswerResult(null);
    setEvidence(null);
    setShowOptionalEvidence(false);
    setSelectedStatementIds([]);
    setConfidenceLevel(null);

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, excludeChunkIds: excludes }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.error?.code === "UNPROCESSABLE_ENTITY") {
          setIsExhausted(true);
          return;
        }
        throw new Error(data.error?.message || "Failed to generate quiz question.");
      }

      setQuestion(data);
      if (data.groundingChunkIds && Array.isArray(data.groundingChunkIds)) {
        setExcludeChunkIds((prev) => Array.from(new Set([...prev, ...data.groundingChunkIds])));
      }
      if (data.mode) {
        setSessionMode(data.mode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load question.";
      setErrorMessage(msg);
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    fetchQuestion([]);
  }, [fetchQuestion]);

  // Fetch evidence for a question
  const fetchEvidenceForQuestion = async (questionId: string) => {
    setIsLoadingEvidence(true);
    try {
      const res = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, questionId }),
      });

      const data = await res.json();
      if (res.ok && data.evidence) {
        setEvidence(data.evidence);
      }
    } catch {
      // Evidence fetch failure handled gracefully
    } finally {
      setIsLoadingEvidence(false);
    }
  };

  const handleToggleStatement = (statementId: string) => {
    if (answerResult) return; // Locked post-submit

    if (sessionMode === "identify_truth") {
      // Radio mode: single selection
      setSelectedStatementIds([statementId]);
    } else {
      // Checkbox mode: toggle up to 2 selections
      if (selectedStatementIds.includes(statementId)) {
        setSelectedStatementIds(selectedStatementIds.filter((id) => id !== statementId));
      } else {
        if (selectedStatementIds.length < 2) {
          setSelectedStatementIds([...selectedStatementIds, statementId]);
        }
      }
    }
  };

  const handleSubmitAnswer = async () => {
    if (!question || confidenceLevel === null || selectedStatementIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.questionId,
          selectedStatementIds,
          confidenceLevel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to submit answer.");
      }

      setAnswerResult({
        correct: data.correct,
        correctStatementIds: data.correctStatementIds || [],
      });

      // Auto-fetch evidence if answer was incorrect (FR-RAG-5)
      if (!data.correct) {
        fetchEvidenceForQuestion(question.questionId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission error.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    const nextQNum = questionNumber + 1;
    setQuestionNumber(nextQNum);
    fetchQuestion(excludeChunkIds);
  };

  const isSubmitDisabled =
    isSubmitting ||
    confidenceLevel === null ||
    selectedStatementIds.length === 0 ||
    (sessionMode === "identify_both_lies" && selectedStatementIds.length !== 2);

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 px-4">
      {/* Session Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-300 border-purple-500/20 mb-1">
            Devil&apos;s Advocate Challenge
          </Badge>
          <h1 className="text-xl font-bold text-slate-100">Source Cross-Examination</h1>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-slate-400 border-slate-800">
            Question #{questionNumber}
          </Badge>
          <Button
            onClick={() => router.push(`/results/${sessionId}`)}
            variant="ghost"
            size="sm"
            className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/30"
          >
            Finish & View Results
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoadingQuestion && (
        <Card className="bg-slate-900/60 border-slate-800 p-8 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">
            Generating grounded Devil&apos;s Advocate question…
          </p>
          <p className="text-xs text-slate-500">
            Scanning document chunks and verifying claim grounding rationale.
          </p>
        </Card>
      )}

      {/* Document Exhausted State */}
      {isExhausted && (
        <Card className="bg-slate-900/80 border-indigo-500/30 text-center p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-100">
            All Concepts Cross-Examined!
          </CardTitle>
          <CardDescription className="text-slate-400 max-w-md mx-auto">
            You have answered questions covering all factual concepts extracted from this document.
          </CardDescription>
          <Button
            onClick={() => router.push(`/results/${sessionId}`)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 mt-2"
          >
            <span>View Performance & Confidence Tracer</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      )}

      {/* Main Question Card */}
      {!isLoadingQuestion && question && !isExhausted && (
        <div className="space-y-6">
          <Card className="bg-slate-900/80 border-slate-800 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">
                  {question.concept}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {question.difficulty}
                </Badge>
              </div>

              <CardTitle className="text-lg font-bold text-slate-100 pt-2 leading-relaxed">
                Spot the Grounded Truth / False Misconceptions
              </CardTitle>

              <CardDescription className="text-xs text-slate-400">
                {sessionMode === "identify_truth"
                  ? "Select the 1 true claim. The other 2 claims are plausible misconceptions."
                  : "Select BOTH false claims (misconceptions) before seeing source evidence."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Statement Cards */}
              {question.statements.map((stmt) => {
                const isSelected = selectedStatementIds.includes(stmt.statementId);
                const isCorrect = answerResult
                  ? answerResult.correctStatementIds.includes(stmt.statementId)
                  : null;

                return (
                  <StatementCard
                    key={stmt.statementId}
                    statementId={stmt.statementId}
                    text={stmt.text}
                    mode={sessionMode}
                    selected={isSelected}
                    disabled={isSubmitting || answerResult !== null}
                    isCorrectAnswer={isCorrect}
                    onToggle={handleToggleStatement}
                  />
                );
              })}

              {/* Confidence Selector */}
              <div className="pt-3">
                <ConfidenceSelector
                  value={confidenceLevel}
                  onChange={setConfidenceLevel}
                  disabled={isSubmitting || answerResult !== null}
                />
              </div>
            </CardContent>

            {!answerResult && (
              <CardFooter className="flex justify-end border-t border-slate-800/80 pt-4">
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitDisabled}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Submit Answer & Reveal Evidence</span>
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Post-Submit Result Affirmation / Feedback */}
          {answerResult && (
            <div className="space-y-4">
              {answerResult.correct ? (
                <Card className="border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-emerald-200">Correct Answer!</h3>
                      <p className="text-xs text-emerald-300/80">
                        Your hypothesis matched the source document text.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    {!showOptionalEvidence ? (
                      <Button
                        onClick={() => {
                          setShowOptionalEvidence(true);
                          fetchEvidenceForQuestion(question.questionId);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-emerald-300 hover:bg-emerald-500/20 gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Show Source Evidence Passage</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-300 font-medium">Source Evidence Loaded</span>
                    )}

                    <Button
                      onClick={handleNextQuestion}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                    >
                      <span>Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="border-red-500/40 bg-red-500/10 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-red-200">Incorrect Hypothesis</h3>
                      <p className="text-xs text-red-300/80">
                        Review the exact source evidence excerpt below to see where your calibration differed.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleNextQuestion}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                    >
                      <span>Continue to Next Question</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              )}

              {/* RAG Source Evidence Panel (Primary feedback on miss, optional on correct) */}
              {(answerResult.correct === false || showOptionalEvidence) && (
                <div className="pt-2">
                  {isLoadingEvidence ? (
                    <Card className="p-4 text-center text-xs text-slate-400 bg-slate-900/60">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-amber-400" />
                      Retrieving exact source excerpt from pgvector…
                    </Card>
                  ) : evidence ? (
                    <EvidencePanel evidence={evidence} />
                  ) : null}
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
