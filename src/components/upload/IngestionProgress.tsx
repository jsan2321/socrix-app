"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, CheckCircle2, AlertOctagon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export interface IngestionProgressProps {
  documentId: string;
  onReady: (documentId: string) => void;
  onError: (failureReason: string) => void;
}

export function IngestionProgress({
  documentId,
  onReady,
  onError,
}: IngestionProgressProps) {
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
        onReady(documentId);
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
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    return () => clearInterval(interval);
  }, [pollStatus]);

  const progressPct =
    totalChunks && totalChunks > 0
      ? Math.round((embeddedCount / totalChunks) * 100)
      : embeddedCount > 0
      ? Math.min(90, embeddedCount * 10)
      : 30;

  return (
    <Card className="border-indigo-500/30 bg-slate-900/80 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-indigo-400 border-indigo-500/30">
            Ingestion Pipeline
          </Badge>
          <span className="text-xs font-mono text-slate-400">
            Doc: {documentId.slice(0, 8)}...
          </span>
        </div>
        <CardTitle className="text-base font-semibold text-slate-100 mt-2">
          {status === "processing" && "Processing & Embedding Document…"}
          {status === "ready" && "Document Ready for Cross-Examination"}
          {status === "failed" && "Ingestion Failed"}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {status === "processing" && (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>Reading pages, extracting semantic chunks & vectors…</span>
              </span>
              <span className="font-semibold text-indigo-400">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-[11px] text-slate-500">
              Generating 1536-dimensional embeddings with OpenAI text-embedding-3-small.
            </p>
          </div>
        )}

        {status === "ready" && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>Document processed successfully! All semantic chunks embedded.</span>
          </div>
        )}

        {status === "failed" && (
          <div
            role="alert"
            className="flex items-center gap-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs"
          >
            <AlertOctagon className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>
              Ingestion failed: {failureReason || "Unprocessable document format"}.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
