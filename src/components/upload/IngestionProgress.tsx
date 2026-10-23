"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, AlertOctagon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/context";

export interface IngestionProgressProps {
  documentId: string;
  onReady: (documentId: string, chunksTotal?: number) => void;
  onError: (failureReason: string) => void;
}

export function IngestionProgress({
  documentId,
  onReady,
  onError,
}: IngestionProgressProps) {
  const { dict } = useI18n();
  const [status, setStatus] = useState<"processing" | "ready" | "failed">("processing");
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [embeddedCount, setEmbeddedCount] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const pollCountRef = useRef(0);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch status: ${res.status}`);
      }

      const data = await res.json();
      pollCountRef.current += 1;

      if (data.chunksEmbeddedCount !== undefined) {
        setEmbeddedCount(data.chunksEmbeddedCount);
      }
      if (data.chunksTotal !== undefined) {
        setTotalChunks(data.chunksTotal);
      }

      // 1. Processing State
      if (data.status === "processing") {
        // Automatically attempt continuation if stuck on processing after multiple polls
        if (pollCountRef.current % 3 === 0) {
          try {
            await fetch(`/api/documents/${documentId}/continue`, { method: "POST" });
          } catch {
            // Ignore background resume error, polling will continue
          }
        }
      } else if (data.status === "ready") {
        setStatus("ready");
        onReady(documentId, typeof data.chunksTotal === "number" ? data.chunksTotal : undefined);
      } else if (data.status === "failed") {
        setStatus("failed");
        const reason = data.failureReason || "unknown";
        setFailureReason(reason);
        onError(reason);
      }
    } catch {
      // Continue polling on transient network glitch
    }
  }, [documentId, onReady, onError]);

  useEffect(() => {
    if (status !== "processing") return;

    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [pollStatus, status]);

  const progressPct = totalChunks && totalChunks > 0
    ? Math.min(100, Math.round((embeddedCount / totalChunks) * 100))
    : null;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
            {dict.ingestion.title}
          </Badge>
          <span className="text-xs font-mono text-muted-foreground">
            Doc: {documentId.slice(0, 8)}...
          </span>
        </div>
        <CardTitle className="text-base font-serif font-bold text-card-foreground mt-2">
          {status === "processing" && dict.ingestion.processing}
          {status === "ready" && dict.ingestion.ready}
          {status === "failed" && dict.ingestion.failed}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "processing" && (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-primary motion-safe:animate-spin" />
                <span>{dict.ingestion.reading}</span>
              </span>
              <span className="font-semibold text-primary">{progressPct === null ? dict.common.loading : `${progressPct}%`}</span>
            </div>
            {progressPct === null ? (
              <div role="progressbar" aria-label="Document ingestion" aria-valuetext="Processing document" className="relative h-2 overflow-hidden rounded-full bg-primary/20">
                <div className="h-full w-1/3 rounded-full bg-primary motion-safe:animate-pulse" />
              </div>
            ) : (
              <Progress value={progressPct} aria-label="Document ingestion" className="h-2" />
            )}
            <p className="text-[11px] text-muted-foreground">
              {dict.ingestion.generatingEmbeddings}
            </p>
          </div>
        )}

        {status === "ready" && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{dict.ingestion.success}</span>
          </div>
        )}

        {status === "failed" && (
          <div
            role="alert"
            className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs"
          >
            <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>
              {dict.ingestion.failedPrefix}: {failureReason || dict.ingestion.unprocessable}.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
