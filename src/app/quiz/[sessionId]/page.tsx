"use client";

import React, { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, XCircle, ArrowRight, Award, Loader2, BookOpen, AlertCircle, Keyboard } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatementCard } from "@/components/quiz/StatementCard";
import { ConfidenceSelector } from "@/components/quiz/ConfidenceSelector";
import { EvidencePanel } from "@/components/quiz/EvidencePanel";
import { KeyboardShortcutsModal } from "@/components/quiz/KeyboardShortcutsModal";
import { useQuizKeyboard } from "@/hooks/useQuizKeyboard";
import type { EvidenceResult } from "@/lib/rag/evidence";
import { fetchQuizQuestion, QuizStreamError, type ClientQuizQuestion, type QuizProgressStatus } from "@/lib/quiz/stream";
import { slideIn, motionTiming } from "@/lib/animations";
import { useI18n } from "@/lib/i18n/context";

interface QuizPageProps {
  params: Promise<{ sessionId: string }>;
}

export default function QuizPage({ params }: QuizPageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { dict } = useI18n();
  const reduceMotion = useReducedMotion();
  const initialSessionRef = useRef<string | null>(null);

  const [question, setQuestion] = useState<ClientQuizQuestion | null>(null);
  const [sessionMode, setSessionMode] = useState<"identify_truth" | "identify_both_lies">("identify_truth");
  const [excludeChunkIds, setExcludeChunkIds] = useState<string[]>([]);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState<number | null>(null);

  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [progressStatus, setProgressStatus] = useState<QuizProgressStatus | null>(null);
  const [revealedChars, setRevealedChars] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean;
    correctStatementIds: string[];
  } | null>(null);

  const [evidence, setEvidence] = useState<EvidenceResult | null>(null);
  const [showOptionalEvidence, setShowOptionalEvidence] = useState(false);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

  const [questionNumber, setQuestionNumber] = useState(1);
  const [questionTarget, setQuestionTarget] = useState<number | null>(null);
  const [isExhausted, setIsExhausted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Fetch next question from API
  const fetchQuestion = useCallback(async (excludes: string[]) => {
    setIsLoadingQuestion(true);
    setIsExhausted(false);
    setProgressStatus(null);
    setRevealedChars(0);
    setQuestion(null);
    setErrorMessage(null);
    setAnswerResult(null);
    setEvidence(null);
    setShowOptionalEvidence(false);
    setSelectedStatementIds([]);
    setConfidenceLevel(null);

    try {
      const data = await fetchQuizQuestion(sessionId, excludes, crypto.randomUUID(), setProgressStatus);

      setQuestion(data);
      if (typeof data.questionTarget === "number") {
        setQuestionTarget(data.questionTarget);
      }
      if (data.groundingChunkIds && Array.isArray(data.groundingChunkIds)) {
        setExcludeChunkIds((prev) => Array.from(new Set([...prev, ...(data.groundingChunkIds ?? [])])));
      }
      if (data.mode) {
        setSessionMode(data.mode);
      }
    } catch (err: unknown) {
      if (err instanceof QuizStreamError && err.code === "UNPROCESSABLE_ENTITY") {
        setIsExhausted(true);
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to load question.";
      setErrorMessage(msg);
    } finally {
      setIsLoadingQuestion(false);
    }
  }, [sessionId]);

  // Initial load
  useEffect(() => {
    if (initialSessionRef.current === sessionId) return;
    initialSessionRef.current = sessionId;
    void fetchQuestion([]);
  }, [fetchQuestion, sessionId]);

  const totalQuestionChars = question?.statements.reduce((sum, statement) => sum + statement.text.length, 0) ?? 0;
  const revealComplete = Boolean(reduceMotion) || revealedChars >= totalQuestionChars;

  useEffect(() => {
    if (!question || reduceMotion || revealedChars >= totalQuestionChars) return;
    const interval = window.setInterval(() => {
      setRevealedChars((current) => Math.min(totalQuestionChars, current + 24));
    }, 16);
    return () => window.clearInterval(interval);
  }, [question, reduceMotion, revealedChars, totalQuestionChars]);

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
    if (!question || !revealComplete || confidenceLevel === null || selectedStatementIds.length === 0) return;

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

      // Fetch evidence automatically after an incorrect answer.
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

  const isTargetReached = Boolean(questionTarget && questionNumber >= questionTarget);

  const handleNextQuestion = () => {
    const nextQNum = questionNumber + 1;
    setQuestionNumber(nextQNum);
    fetchQuestion(excludeChunkIds);
  };

  const handleAdvance = () => {
    if (isTargetReached) {
      router.push(`/results/${sessionId}`);
    } else {
      handleNextQuestion();
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    !revealComplete ||
    confidenceLevel === null ||
    selectedStatementIds.length === 0 ||
    (sessionMode === "identify_both_lies" && selectedStatementIds.length !== 2);

  const statementIds = question?.statements.map((s) => s.statementId) ?? [];

  useQuizKeyboard({
    enabled: !isLoadingQuestion && question !== null && !isExhausted,
    statementIds,
    onToggleStatement: handleToggleStatement,
    onSetConfidence: setConfidenceLevel,
    onSubmitAnswer: () => void handleSubmitAnswer(),
    onNextQuestion: handleAdvance,
    onToggleEvidence: () => {
      if (answerResult) {
        setShowOptionalEvidence((prev) => !prev);
        if (!evidence && question) {
          void fetchEvidenceForQuestion(question.questionId);
        }
      }
    },
    onToggleHelp: () => setIsHelpOpen((prev) => !prev),
    isSubmitted: answerResult !== null,
    canSubmit: !isSubmitDisabled,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4 px-4">
      {/* Session Header */}
      <div className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-mono font-semibold uppercase tracking-[0.16em] text-primary mb-1.5">
              {dict.quiz.challengeBadge}
            </p>
            <h1 className="text-2xl font-serif font-bold text-foreground">{dict.quiz.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsHelpOpen(true)}
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
              title={dict.quiz.shortcutToggleHelp}
              aria-label={dict.quiz.shortcutToggleHelp}
            >
              <Keyboard className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">{dict.quiz.shortcutsTitle}</span>
            </Button>

            <Badge variant="outline" className="text-muted-foreground border-border font-medium">
              {questionTarget
                ? dict.quiz.questionOfTarget
                    .replace("{current}", String(questionNumber))
                    .replace("{total}", String(questionTarget))
                : `${dict.quiz.questionNum}${questionNumber}`}
            </Badge>
            <Button
              onClick={() => router.push(`/results/${sessionId}`)}
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {dict.quiz.finishEarly}
            </Button>
          </div>
        </div>

        {/* Target Progress Bar */}
        {questionTarget && questionTarget > 0 && (
          <div className="w-full bg-secondary/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300 ease-out rounded-full"
              style={{
                width: `${Math.min(100, Math.round((Math.min(questionNumber, questionTarget) / questionTarget) * 100))}%`,
              }}
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuenow={questionNumber}
              aria-valuemin={1}
              aria-valuemax={questionTarget}
            />
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoadingQuestion && (
        <Card className="bg-card border-border p-8 text-center space-y-5" aria-live="polite">
          <div className="w-10 h-10 mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary motion-safe:animate-spin" />
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-serif font-semibold text-foreground transition-all duration-300">
              {progressStatus === null && dict.quiz.loadingStage0}
              {progressStatus === "selecting" && dict.quiz.loadingStage0}
              {progressStatus === "generating" && dict.quiz.loadingStage1}
              {progressStatus === "validating" && dict.quiz.loadingStage2}
              {progressStatus === "persisting" && dict.quiz.loadingStage3}
            </p>
            <p className="text-xs text-muted-foreground">
              {dict.quiz.loadingSubtitle}
            </p>
          </div>

        </Card>
      )}

      {/* Document Exhausted State */}
      {isExhausted && (
        <Card className="bg-card border-primary/30 text-center p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
            <Award className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-serif font-bold text-card-foreground">
            {dict.quiz.exhaustedTitle}
          </CardTitle>
          <CardDescription className="text-muted-foreground max-w-md mx-auto">
            {dict.quiz.exhaustedDesc}
          </CardDescription>
          <Button
            onClick={() => router.push(`/results/${sessionId}`)}
            className="gap-2 mt-2 shadow-sm"
          >
            <span>{dict.quiz.viewResults}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      )}

      {!isLoadingQuestion && !question && !isExhausted && errorMessage && (
        <Card className="space-y-4 border-destructive/30 p-6 text-center" role="alert">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button onClick={() => void fetchQuestion(excludeChunkIds)}>Try Again</Button>
        </Card>
      )}

      {/* Main Question Card */}
      {!isLoadingQuestion && question && !isExhausted && (
        <div className="space-y-6" data-question-ready={revealComplete}>
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                  {question.concept}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {question.difficulty}
                </Badge>
              </div>

              <CardTitle className="text-lg font-serif font-bold text-card-foreground pt-2 leading-relaxed">
                {dict.quiz.spotTitle}
              </CardTitle>

              <CardDescription className="text-xs text-muted-foreground">
                {sessionMode === "identify_truth"
                  ? dict.modes.spotTruthSubtitle
                  : dict.modes.spotBothLiesSubtitle}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Statement Cards */}
              {question.statements.map((stmt, idx) => {
                const isSelected = selectedStatementIds.includes(stmt.statementId);
                const isCorrect = answerResult
                  ? answerResult.correctStatementIds.includes(stmt.statementId)
                  : null;
                const charsBefore = question.statements.slice(0, idx).reduce((sum, previous) => sum + previous.text.length, 0);
                const revealPercent = reduceMotion ? 100 : Math.max(0, Math.min(100, ((revealedChars - charsBefore) / stmt.text.length) * 100));

                return (
                  <motion.div key={stmt.statementId} initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={{ ...motionTiming, delay: reduceMotion ? 0 : idx * 0.05 }}>
                  <StatementCard
                    key={stmt.statementId}
                    statementId={stmt.statementId}
                    text={stmt.text}
                    revealPercent={revealPercent}
                    mode={sessionMode}
                    selected={isSelected}
                    letter={["A", "B", "C"][idx]}
                    disabled={!revealComplete || isSubmitting || answerResult !== null}
                    isCorrectAnswer={isCorrect}
                    onToggle={handleToggleStatement}
                  />
                  </motion.div>
                );
              })}

              {/* Confidence Selector */}
              <div className="pt-3">
                <ConfidenceSelector
                  value={confidenceLevel}
                  onChange={setConfidenceLevel}
                  disabled={!revealComplete || isSubmitting || answerResult !== null}
                />
              </div>
            </CardContent>

            {!answerResult && (
              <CardFooter className="flex justify-end border-t border-border pt-4">
                <Button
                  onClick={handleSubmitAnswer}
                  disabled={isSubmitDisabled}
                  className="font-semibold gap-2 shadow-sm px-6"
                >
                  {isSubmitting && (
                    <Loader2 className="w-4 h-4 motion-safe:animate-spin" />
                  )}
                  <span>{dict.quiz.submitBtn}</span>
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Post-Submit Result Affirmation / Feedback */}
          {answerResult && (
            <motion.div className="space-y-4" initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={motionTiming}>
              {isTargetReached && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3.5 text-xs text-foreground flex items-center gap-2.5">
                  <Award className="w-5 h-5 text-primary flex-shrink-0" />
                  <p>
                    <strong className="font-semibold">{dict.quiz.targetReachedTitle}</strong>{" "}
                    <span className="text-muted-foreground">{dict.quiz.targetReachedDesc.replace("{target}", String(questionTarget))}</span>
                  </p>
                </div>
              )}

              {answerResult.correct ? (
                <Card className="border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <div>
                      <h3 className="text-base font-serif font-bold text-emerald-900 dark:text-emerald-100">{dict.quiz.correctTitle}</h3>
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                        {dict.quiz.correctDesc}
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
                        className="text-xs text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{dict.quiz.showEvidence}</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">{dict.quiz.evidenceLoaded}</span>
                    )}

                    <Button
                      onClick={handleAdvance}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 shadow-sm font-semibold"
                    >
                      <span>{isTargetReached ? dict.quiz.completeAndResults : dict.quiz.nextQuestion}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="border-destructive/40 bg-destructive/10 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                    <div>
                      <h3 className="text-base font-serif font-bold text-destructive">{dict.quiz.incorrectTitle}</h3>
                      <p className="text-xs text-destructive/80">
                        {dict.quiz.incorrectDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleAdvance}
                      className="gap-2 shadow-sm px-5 font-semibold"
                    >
                      <span>{isTargetReached ? dict.quiz.completeAndResults : dict.quiz.continueNext}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              )}

              {/* RAG Source Evidence Panel (Primary feedback on miss, optional on correct) */}
              {(answerResult.correct === false || showOptionalEvidence) && (
                <motion.div className="pt-2" initial={reduceMotion ? false : "hidden"} animate="visible" variants={slideIn} transition={motionTiming}>
                  {isLoadingEvidence ? (
                    <Card className="p-4 text-center text-xs text-muted-foreground bg-muted/40 border-border">
                      <Loader2 className="w-4 h-4 motion-safe:animate-spin mx-auto mb-1 text-primary" />
                      {dict.evidence.retrieving}
                    </Card>
                  ) : evidence ? (
                    <EvidencePanel evidence={evidence} />
                  ) : null}
                </motion.div>
              )}
            </motion.div>
          )}

          {errorMessage && (
            <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
