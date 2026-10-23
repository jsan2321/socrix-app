"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, FileText, Play, Trophy, Loader2, X, AlertCircle, Trash2 } from "lucide-react";
import { DashboardDocument } from "@/lib/db/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AccuracyTrend } from "@/components/dashboard/AccuracyTrend";
import { useI18n } from "@/lib/i18n/context";
import { SessionLengthPicker } from "@/components/quiz/SessionLengthPicker";
import { QuizLanguagePicker, type QuizLanguage } from "@/components/quiz/QuizLanguagePicker";

const statusVariant = {
  ready: "success",
  processing: "warning",
  failed: "destructive",
} as const;

export function DocumentCard({
  document,
  onDeleted,
}: {
  document: DashboardDocument;
  onDeleted?: (documentId: string) => void;
}) {
  const router = useRouter();
  const { dict } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [mode, setMode] = useState<"identify_truth" | "identify_both_lies">("identify_truth");
  const totalChunks = document.chunksTotal ?? 3;
  const [questionTarget, setQuestionTarget] = useState<number | null>(() => {
    return totalChunks <= 3 ? totalChunks : Math.min(5, totalChunks);
  });
  const [quizLanguage, setQuizLanguage] = useState<QuizLanguage>("auto");
  const [isStarting, setIsStarting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = document.sessions.filter((session) => session.totalAnswered > 0);

  const handleDeleteDocument = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to delete document");
      }
      onDeleted?.(document.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleStartSession = async (selectedMode = mode) => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: document.id,
          mode: selectedMode,
          questionTarget,
          quizLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to start quiz session");
      }
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(`session_token_${data.sessionId}`, data.sessionToken);
        }
      } catch {
        // Fallback gracefully if localStorage is restricted
      }
      router.push(`/quiz/${data.sessionId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setIsStarting(false);
    }
  };

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="font-serif text-xl">{document.title}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {dict.dashboard.uploaded} {new Date(document.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Badge variant={statusVariant[document.status]}>{document.status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span>{document.pageCount ?? "—"} {dict.dashboard.pages}</span>
            <span>{document.chunksTotal ?? "—"} {dict.dashboard.chunks}</span>
            <span>{document.sessions.length} {dict.dashboard.sessions}</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <AccuracyTrend values={completed.map((session) => session.accuracy).reverse()} />
            <div className="text-right text-sm">
              <p className="text-muted-foreground">{dict.dashboard.bestAccuracy}</p>
              <p className="font-semibold text-foreground">
                {document.bestAccuracy === null ? "—" : `${Math.round(document.bestAccuracy * 100)}%`}
              </p>
            </div>
          </div>

          {/* Past Sessions List */}
          {document.sessions.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="gap-1 px-0 text-primary hover:text-primary"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                {dict.dashboard.sessionHistory}
              </Button>
              {expanded && (
                <ul className="space-y-2 border-t border-border pt-3" aria-label={dict.dashboard.pastSessions}>
                  {document.sessions.map((session) => (
                    <li key={session.id} className="flex justify-between text-sm">
                      <span>
                        {new Date(session.createdAt).toLocaleDateString()} · {session.totalAnswered} {dict.dashboard.questions}
                      </span>
                      <Link className="font-medium text-primary hover:underline" href={`/results/${session.id}`}>
                        {session.totalAnswered ? `${Math.round(session.accuracy * 100)}%` : dict.dashboard.inProgress}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Inline Mode Selection Section */}
          {showModePicker && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{dict.dashboard.selectMode}</span>
                <button
                  type="button"
                  onClick={() => setShowModePicker(false)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                  aria-label="Close mode selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => setMode("identify_truth")}
                  className={`p-2.5 rounded-lg border transition-all text-left ${
                    mode === "identify_truth"
                      ? "border-primary bg-primary/20 ring-1 ring-primary/40 font-semibold"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <p className="text-xs font-semibold text-foreground">{dict.modes.identifyTruth}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{dict.modes.spotTruthSubtitle}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("identify_both_lies")}
                  className={`p-2.5 rounded-lg border transition-all text-left ${
                    mode === "identify_both_lies"
                      ? "border-primary bg-primary/20 ring-1 ring-primary/40 font-semibold"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <p className="text-xs font-semibold text-foreground">{dict.modes.identifyBothLies}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{dict.modes.spotBothLiesSubtitle}</p>
                </button>
              </div>

              {/* Session Question Target / Length Picker */}
              <div className="border-t border-primary/10 pt-3">
                <SessionLengthPicker
                  totalChunks={totalChunks}
                  value={questionTarget}
                  onChange={setQuestionTarget}
                  disabled={isStarting}
                />
              </div>

              {/* Practice Language Picker */}
              <div className="border-t border-primary/10 pt-3">
                <QuizLanguagePicker
                  value={quizLanguage}
                  onChange={setQuizLanguage}
                  disabled={isStarting}
                />
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                size="sm"
                className="w-full gap-2 shadow-sm font-semibold"
                disabled={isStarting}
                onClick={() => handleStartSession(mode)}
              >
                {isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span>{isStarting ? dict.dashboard.startingSession : dict.dashboard.beginSession}</span>
              </Button>
            </div>
          )}

          {!showModePicker && error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </div>

      <CardFooter className="gap-2 pt-2">
        {!showModePicker ? (
          <Button
            size="sm"
            disabled={document.status !== "ready" || isStarting || isDeleting}
            onClick={() => setShowModePicker(true)}
            className="gap-1 font-semibold"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{dict.dashboard.startQuiz}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowModePicker(false)}
            className="text-xs text-muted-foreground"
          >
            {dict.common.cancel}
          </Button>
        )}

        {completed[0] && (
          <Link href={`/results/${completed[0].id}`}>
            <Button variant="outline" size="sm" className="gap-1">
              <Trophy className="h-3.5 w-3.5" />
              <span>{dict.dashboard.pastResults}</span>
            </Button>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {!confirmingDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => setConfirmingDelete(true)}
              aria-label={dict.dashboard.deleteDoc}
              title={dict.dashboard.deleteDoc}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteDocument}
                className="h-7 px-2 text-xs"
              >
                {isDeleting ? dict.dashboard.deleting : dict.dashboard.confirmDelete}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                onClick={() => setConfirmingDelete(false)}
                className="h-7 px-2 text-xs"
              >
                {dict.common.cancel}
              </Button>
            </>
          )}
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardFooter>
    </Card>
  );
}
