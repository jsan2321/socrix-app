"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, ShieldAlert, ArrowRight, FileText, X, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropzone } from "@/components/upload/Dropzone";
import { IngestionProgress } from "@/components/upload/IngestionProgress";
import { SessionLengthPicker } from "@/components/quiz/SessionLengthPicker";
import { QuizLanguagePicker, type QuizLanguage } from "@/components/quiz/QuizLanguagePicker";
import { useI18n } from "@/lib/i18n/context";
import { formatBytes } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  ensureActiveSession,
  getGuestUploadCount,
  incrementGuestUploadCount,
  isGuestUser,
  MAX_GUEST_UPLOADS,
} from "@/lib/auth/guest-session";

type UploadStep = "upload" | "ingesting" | "ready" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { dict } = useI18n();
  const [step, setStep] = useState<UploadStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<"identify_truth" | "identify_both_lies">("identify_truth");
  const [chunksTotal, setChunksTotal] = useState<number>(3);
  const [questionTarget, setQuestionTarget] = useState<number | null>(3);
  const [quizLanguage, setQuizLanguage] = useState<QuizLanguage>("auto");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestUploads, setGuestUploads] = useState(0);

  useEffect(() => {
    setGuestUploads(getGuestUploadCount());
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsGuest(!user || isGuestUser(user));
    });
  }, []);

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    if (!title.trim()) {
      setTitle(file.name.replace(/\.pdf$/i, ""));
    }
  };

  const handleCancelFile = () => {
    setSelectedFile(null);
    setTitle("");
    setErrorMessage(null);
  };

  const handleUploadAndAnalyze = async () => {
    if (!selectedFile) return;

    if (isGuest && guestUploads >= MAX_GUEST_UPLOADS) {
      setErrorMessage(dict.upload.guestQuotaReachedDesc);
      setStep("error");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      await ensureActiveSession();

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title.trim()) {
        formData.append("title", title.trim());
      } else {
        formData.append("title", selectedFile.name.replace(/\.pdf$/i, ""));
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText =
          data.error?.message ||
          (res.status === 413
            ? "File size exceeds server upload limit of 50 MB."
            : res.status === 409
            ? "This document has already been processed."
            : "Failed to upload document.");

        if (res.status === 409 && data.error?.details?.documentId) {
          // Handle existing document reuse
          setDocumentId(data.error.details.documentId);
          setStep("ingesting");
          return;
        }

        setErrorMessage(errorText);
        setStep("error");
        return;
      }

      if (isGuest) {
        const next = incrementGuestUploadCount();
        setGuestUploads(next);
      }

      setDocumentId(data.documentId);
      setStep("ingesting");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during upload.";
      setErrorMessage(msg);
      setStep("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleIngestionReady = (docId: string, total?: number) => {
    setDocumentId(docId);
    if (typeof total === "number" && total > 0) {
      setChunksTotal(total);
      setQuestionTarget(total <= 3 ? total : Math.min(5, total));
    }
    setStep("ready");
  };

  const handleIngestionError = (reason: string) => {
    const reasonsMap = dict.upload.failureReasons as Record<string, string>;
    const readableMsg = reasonsMap[reason] || `${dict.ingestion.failedPrefix}: ${reason}`;
    setErrorMessage(readableMsg);
    setStep("error");
  };

  const handleStartQuiz = async () => {
    if (!documentId) return;

    setIsStartingSession(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, mode, questionTarget, quizLanguage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to initialize quiz session.");
      }

      // Persist session token in localStorage with fallback
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(`session_token_${data.sessionId}`, data.sessionToken);
        }
      } catch {
        // Fallback gracefully if localStorage is restricted
      }

      router.push(`/quiz/${data.sessionId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start quiz session.";
      setErrorMessage(msg);
    } finally {
      setIsStartingSession(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
      <div className="space-y-2 text-center">
        <p className="text-xs font-mono font-semibold uppercase tracking-[0.18em] text-primary">
          {dict.upload.preTitle}
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-foreground">
          {dict.upload.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.upload.subtitle}
        </p>
      </div>

      {/* Subtle Guest Trial Banner */}
      {isGuest && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {dict.upload.guestTrialNotice.replace("{count}", String(Math.max(0, MAX_GUEST_UPLOADS - guestUploads)))}
          </span>
          <Link
            href="/auth/register"
            className="font-medium text-primary hover:underline transition-colors"
          >
            {dict.upload.guestCreateAccountPrompt} →
          </Link>
        </div>
      )}

      {/* Guest Limit Exceeded Card */}
      {isGuest && guestUploads >= MAX_GUEST_UPLOADS && step === "upload" && !selectedFile && (
        <Card className="text-center p-8 border-border/80 bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-serif text-foreground">
              {dict.upload.guestQuotaReachedTitle}
            </CardTitle>
            <CardDescription className="max-w-md mx-auto text-sm mt-2">
              {dict.upload.guestQuotaReachedDesc}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center gap-3 pt-2">
            <Button
              type="button"
              onClick={() => router.push("/auth/register")}
              className="font-semibold"
            >
              {dict.nav.createAccount}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/auth/login")}
            >
              {dict.nav.signIn}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Upload Dropzone (When no file is selected yet) */}
      {step === "upload" && !selectedFile && (!isGuest || guestUploads < MAX_GUEST_UPLOADS) && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-serif font-bold text-card-foreground">
              {dict.upload.cardTitle}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dict.upload.cardDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="doc-title" className="text-xs font-medium text-foreground">
                {dict.upload.titleLabel}
              </Label>
              <Input
                id="doc-title"
                type="text"
                placeholder={dict.upload.titlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground/70 focus:border-primary"
              />
            </div>

            <Dropzone onFileSelected={handleFileSelected} disabled={isUploading} />
          </CardContent>
        </Card>
      )}

      {/* Step 1b: Staged Document Review (File selected, user can review title, cancel or analyze) */}
      {step === "upload" && selectedFile && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                {dict.upload.selectedFileLabel}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelFile}
                disabled={isUploading}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                aria-label={dict.upload.cancelOrChangeFile}
                title={dict.upload.cancelOrChangeFile}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardTitle className="text-lg font-serif font-bold text-card-foreground mt-2">
              {dict.upload.cardTitle}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dict.upload.fileReadyNotice}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* File info pill */}
            <div className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dict.upload.fileSizeLabel}: {formatBytes(selectedFile.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCancelFile}
                disabled={isUploading}
                className="text-xs flex-shrink-0"
              >
                {dict.upload.changeFileBtn}
              </Button>
            </div>

            {/* Editable Title */}
            <div className="space-y-2">
              <Label htmlFor="doc-title-staged" className="text-xs font-medium text-foreground">
                {dict.upload.titleLabel}
              </Label>
              <Input
                id="doc-title-staged"
                type="text"
                placeholder={dict.upload.titlePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground/70 focus:border-primary"
              />
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelFile}
              disabled={isUploading}
              className="text-sm"
            >
              {dict.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleUploadAndAnalyze}
              disabled={isUploading}
              className="gap-2 font-medium px-6 shadow-sm"
            >
              {isUploading ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>{dict.upload.analyzingBtn}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{dict.upload.analyzeBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Ingestion Progress Polling */}
      {step === "ingesting" && documentId && (
        <IngestionProgress
          documentId={documentId}
          onReady={handleIngestionReady}
          onError={handleIngestionError}
        />
      )}

      {/* Step 3: Ready State & Mode Selector */}
      {step === "ready" && (
        <Card className="border-primary/30 bg-card shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                {dict.upload.documentIngested}
              </Badge>
            </div>
            <CardTitle className="text-xl font-serif font-bold text-card-foreground mt-2">
              {dict.upload.selectModeLabel}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {dict.upload.selectModeDesc}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Mode Option 1: Identify the Truth */}
            <div
              onClick={() => setMode("identify_truth")}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                mode === "identify_truth"
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-background/50 hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div className="mt-0.5">
                <input
                  type="radio"
                  id="mode-truth"
                  name="quiz-mode"
                  checked={mode === "identify_truth"}
                  onChange={() => setMode("identify_truth")}
                  className="h-4 w-4 accent-primary text-primary focus:ring-primary border-border"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mode-truth" className="text-sm font-semibold text-foreground cursor-pointer">
                  {dict.upload.identifyTruthTitle}
                </label>
                <p className="text-xs text-muted-foreground">
                  {dict.upload.identifyTruthDesc}
                </p>
              </div>
            </div>

            {/* Mode Option 2: Identify Both Lies */}
            <div
              onClick={() => setMode("identify_both_lies")}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                mode === "identify_both_lies"
                  ? "border-primary bg-primary/10 text-foreground shadow-sm"
                  : "border-border bg-background/50 hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div className="mt-0.5">
                <input
                  type="radio"
                  id="mode-lies"
                  name="quiz-mode"
                  checked={mode === "identify_both_lies"}
                  onChange={() => setMode("identify_both_lies")}
                  className="h-4 w-4 accent-primary text-primary focus:ring-primary border-border"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mode-lies" className="text-sm font-semibold text-foreground cursor-pointer">
                  {dict.upload.identifyBothLiesTitle}
                </label>
                <p className="text-xs text-muted-foreground">
                  {dict.upload.identifyBothLiesDesc}
                </p>
              </div>
            </div>

            {/* Session Length Picker */}
            <div className="border-t border-border pt-4">
              <SessionLengthPicker
                totalChunks={chunksTotal}
                value={questionTarget}
                onChange={setQuestionTarget}
                disabled={isStartingSession}
              />
            </div>

            {/* Practice Language Picker */}
            <div className="border-t border-border pt-4">
              <QuizLanguagePicker
                value={quizLanguage}
                onChange={setQuizLanguage}
                disabled={isStartingSession}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end pt-2">
            <Button
              onClick={handleStartQuiz}
              disabled={isStartingSession}
              className="gap-2 font-medium px-6 shadow-sm"
            >
              {isStartingSession ? (
                <span>{dict.upload.startingSession}</span>
              ) : (
                <>
                  <span>{dict.upload.startCrossExam}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Error State Card */}
      {step === "error" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <Badge variant="outline" className="text-destructive border-destructive/30">
                Upload Error
              </Badge>
            </div>
            <CardTitle className="text-lg font-serif font-bold text-foreground mt-2">
              {dict.upload.errorTitle}
            </CardTitle>
            <CardDescription className="text-destructive text-sm">
              {errorMessage || "An unhandled error occurred."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() => {
                setStep("upload");
                setSelectedFile(null);
                setErrorMessage(null);
              }}
              variant="outline"
              className="border-border text-foreground hover:bg-secondary"
            >
              {dict.upload.tryAnotherPdf}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
