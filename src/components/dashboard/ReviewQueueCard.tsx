"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  RotateCcw,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Loader2,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DueConceptItem, RepetitionStats } from "@/lib/db/repetition";
import { useI18n } from "@/lib/i18n/context";

interface ReviewQueueCardProps {
  dueConcepts: DueConceptItem[];
  stats: RepetitionStats;
}

export function ReviewQueueCard({ dueConcepts, stats }: ReviewQueueCardProps) {
  const router = useRouter();
  const { dict } = useI18n();
  const [startingDocId, setStartingDocId] = useState<string | null>(null);

  const handleStartReview = async (documentId: string) => {
    setStartingDocId(documentId);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, mode: "identify_truth" }),
      });
      const data = await res.json();
      if (res.ok && data.sessionId) {
        if (typeof window !== "undefined" && window.localStorage && data.sessionToken) {
          try {
            window.localStorage.setItem(`session_token_${data.sessionId}`, data.sessionToken);
          } catch {
            // Ignore storage restriction
          }
        }
        router.push(`/quiz/${data.sessionId}`);
      }
    } catch {
      // Handled silently
    } finally {
      setStartingDocId(null);
    }
  };

  const getStatusBadge = (status: DueConceptItem["status"]) => {
    switch (status) {
      case "mastered":
        return (
          <Badge className="bg-emerald-700 text-white text-[11px]">
            {dict.repetition.mastered}
          </Badge>
        );
      case "retained":
        return (
          <Badge className="bg-sky-700 text-white text-[11px]">
            {dict.repetition.retained}
          </Badge>
        );
      case "strengthening":
        return (
          <Badge className="bg-indigo-700 text-white text-[11px]">
            {dict.repetition.strengthening}
          </Badge>
        );
      case "needs_review":
      default:
        return (
          <Badge variant="destructive" className="text-[11px]">
            {dict.repetition.needsReview}
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <RotateCcw className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-serif font-bold text-foreground">
                  {dict.dashboard.reviewQueueTitle}
                </CardTitle>
                {stats.dueCount > 0 && (
                  <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/30 text-xs font-semibold">
                    {stats.dueCount} {dict.dashboard.dueCount.toLowerCase()}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {dict.dashboard.reviewQueueSubtitle}
              </CardDescription>
            </div>
          </div>

          {dueConcepts.length > 0 && (
            <Button
              size="sm"
              onClick={() => handleStartReview(dueConcepts[0].documentId)}
              disabled={startingDocId !== null}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm self-start sm:self-auto"
            >
              {startingDocId === dueConcepts[0].documentId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{dict.dashboard.reviewNowBtn}</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {dueConcepts.length === 0 ? (
          <div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-dashed border-border bg-secondary/20 text-muted-foreground text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{dict.dashboard.reviewQueueEmpty}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueConcepts.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-border bg-background/50 hover:bg-muted/30 transition-colors flex flex-col justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-serif font-semibold text-foreground truncate" title={item.concept}>
                      {item.concept}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1" title={item.documentTitle}>
                    <BookOpen className="w-3 h-3 text-primary flex-shrink-0" />
                    <span>{item.documentTitle}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{item.intervalDays} {dict.dashboard.daysSuffix}</span>
                  </span>

                  <button
                    onClick={() => handleStartReview(item.documentId)}
                    disabled={startingDocId !== null}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    <span>{dict.dashboard.reviewNowBtn}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
