"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle, ShieldAlert, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dropzone } from "@/components/upload/Dropzone";
import { IngestionProgress } from "@/components/upload/IngestionProgress";

type UploadStep = "upload" | "ingesting" | "ready" | "error";

const FAILURE_REASON_MESSAGES: Record<string, string> = {
  encrypted: "This PDF is password-protected or encrypted. Please remove encryption and try again.",
  likely_scanned: "This PDF appears to be a scanned document without text layer. Scanned OCR is not supported in MVP.",
  no_extractable_text: "No readable text characters could be extracted from this PDF.",
  malformed: "The PDF file header or structure is corrupted.",
  embedding_error: "Vector embedding service timed out or failed.",
  unknown: "An unexpected error occurred during document processing.",
};

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<UploadStep>("upload");
  const [title, setTitle] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mode, setMode] = useState<"identify_truth" | "identify_both_lies">("identify_truth");
  const [isStartingSession, setIsStartingSession] = useState(false);

  const handleFileSelected = async (file: File) => {
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      } else {
        formData.append("title", file.name.replace(/\.pdf$/i, ""));
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

  const handleIngestionReady = (docId: string) => {
    setDocumentId(docId);
    setStep("ready");
  };

  const handleIngestionError = (reason: string) => {
    const readableMsg = FAILURE_REASON_MESSAGES[reason] || `Ingestion failed: ${reason}`;
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
        body: JSON.stringify({ documentId, mode }),
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
        <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
          Document Ingestion
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Upload Study Material</h1>
        <p className="text-sm text-slate-400">
          Upload your PDF textbook chapter or lecture notes to generate source-grounded Devil&apos;s Advocate quizzes.
        </p>
      </div>

      {/* Step 1: Upload Dropzone */}
      {step === "upload" && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">PDF File Upload</CardTitle>
            <CardDescription className="text-slate-400">
              Optional title & PDF drag-and-drop dropzone (max 50 MB).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="doc-title" className="text-xs font-medium text-slate-300">
                Document Title (Optional)
              </Label>
              <Input
                id="doc-title"
                type="text"
                placeholder="e.g., Biology Chapter 4 — Cellular Respiration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                className="bg-slate-950/60 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500"
              />
            </div>

            <Dropzone onFileSelected={handleFileSelected} disabled={isUploading} />
          </CardContent>
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
        <Card className="bg-slate-900/80 border-emerald-500/30 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                Document Ingested
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold text-slate-100 mt-2">
              Select Your Challenge Mode
            </CardTitle>
            <CardDescription className="text-slate-400">
              Choose how you want to cross-examine your knowledge against the source text.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Mode Option 1: Identify the Truth */}
            <div
              onClick={() => setMode("identify_truth")}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                mode === "identify_truth"
                  ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/40"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <div className="mt-0.5">
                <input
                  type="radio"
                  id="mode-truth"
                  name="quiz-mode"
                  checked={mode === "identify_truth"}
                  onChange={() => setMode("identify_truth")}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-700"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mode-truth" className="text-sm font-semibold text-slate-200 cursor-pointer">
                  Identify the Truth
                </label>
                <p className="text-xs text-slate-400">
                  Each question presents 1 true statement and 2 plausible misconceptions. Find the 1 true claim.
                </p>
              </div>
            </div>

            {/* Mode Option 2: Identify Both Lies */}
            <div
              onClick={() => setMode("identify_both_lies")}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-4 ${
                mode === "identify_both_lies"
                  ? "border-purple-500 bg-purple-500/10 dark:bg-purple-950/40"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <div className="mt-0.5">
                <input
                  type="radio"
                  id="mode-lies"
                  name="quiz-mode"
                  checked={mode === "identify_both_lies"}
                  onChange={() => setMode("identify_both_lies")}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-700"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="mode-lies" className="text-sm font-semibold text-slate-200 cursor-pointer">
                  Identify Both Lies
                </label>
                <p className="text-xs text-slate-400">
                  Select both false statements (misconceptions) before seeing any AI explanation.
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end pt-2">
            <Button
              onClick={handleStartQuiz}
              disabled={isStartingSession}
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 font-medium px-6"
            >
              {isStartingSession ? (
                <span>Starting Session…</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Cross-Examination Quiz</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Error State Card */}
      {step === "error" && (
        <Card className="bg-slate-900/80 border-red-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              <Badge variant="outline" className="text-red-400 border-red-500/30">
                Upload Error
              </Badge>
            </div>
            <CardTitle className="text-lg text-slate-200 mt-2">
              Unable to Process Document
            </CardTitle>
            <CardDescription className="text-red-300/90 text-sm">
              {errorMessage || "An unhandled error occurred."}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-end">
            <Button
              onClick={() => {
                setStep("upload");
                setErrorMessage(null);
              }}
              variant="outline"
              className="border-slate-800 text-slate-300 hover:bg-slate-800"
            >
              Try Another PDF
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
