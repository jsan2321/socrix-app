"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Share2,
  Copy,
  Check,
  Download,
  Printer,
  X,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useI18n } from "@/lib/i18n/context";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  documentTitle: string;
  masteryPercentage: number;
  totalAnswered: number;
  correctCount: number;
  calibrationLabel: string;
  blindSpotsCount: number;
  hiddenStrengthsCount: number;
}

export function ShareModal({
  isOpen,
  onClose,
  sessionId,
  documentTitle,
  masteryPercentage,
  totalAnswered,
  correctCount,
  calibrationLabel,
  blindSpotsCount,
  hiddenStrengthsCount,
}: ShareModalProps) {
  const { dict } = useI18n();
  const reduceMotion = useReducedMotion();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/share/${sessionId}`);
    }
  }, [sessionId]);

  const summaryText = [
    `🎯 Socratic Cross-Examiner — Study Session Dossier`,
    `📖 Source: ${documentTitle}`,
    `🏆 Mastery Score: ${masteryPercentage}% (${correctCount} of ${totalAnswered} concepts retained)`,
    `🧠 Self-Awareness: ${calibrationLabel}`,
    `🔍 Metacognitive Insights:`,
    `   • Blind Spots (Illusions of Competence): ${blindSpotsCount}`,
    `   • Hidden Strengths (Doubted but Correct): ${hiddenStrengthsCount}`,
    shareUrl ? `🔗 Review Session Dossier: ${shareUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const handleCopyLink = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch {
      // Fallback: execCommand copy
      try {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        // No-op
      }
    } finally {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }, [shareUrl]);

  const handleCopySummary = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = summaryText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = summaryText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        // No-op
      }
    } finally {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    }
  }, [summaryText]);

  const handlePrint = useCallback(() => {
    onClose();
    setTimeout(() => {
      window.print();
    }, 150);
  }, [onClose]);

  const handleDownloadJson = useCallback(() => {
    const downloadUrl = `/api/sessions/${sessionId}/export?download=true`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `socratic-dossier-${sessionId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [sessionId]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        {/* Backdrop click */}
        <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

        {/* Modal Dialog Card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl z-10 text-card-foreground"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share2 className="h-4 w-4" />
              </div>
              <div>
                <h2 id="share-modal-title" className="text-base font-serif font-bold text-foreground">
                  {dict.export.shareTitle}
                </h2>
                <p className="text-xs text-muted-foreground">{dict.export.shareSubtitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label={dict.export.closeModal}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-5 p-6">
            {/* Share Link Row */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>{dict.export.shareUrlLabel}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary select-all"
                  aria-label={dict.export.shareUrlLabel}
                />
                <Button
                  onClick={handleCopyLink}
                  size="sm"
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 min-w-[110px]"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span className="text-xs font-medium">{dict.export.linkCopiedToast}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-xs">{dict.export.copyLinkBtn}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Formatted Text Summary Card Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>{dict.export.summaryCardTab}</span>
                </label>
                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                  Markdown / Plain Text
                </Badge>
              </div>

              <div className="relative rounded-xl border border-border bg-secondary/30 p-3 text-xs font-mono text-foreground/90 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">
                {summaryText}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="gap-1.5 border-border hover:bg-secondary text-xs"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{dict.export.summaryCopiedToast}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{dict.export.copySummaryBtn}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Export Actions */}
            <div className="border-t border-border pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2 border-border text-foreground hover:bg-secondary justify-center py-5"
                >
                  <Printer className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <p className="text-xs font-medium leading-none">{dict.export.printBtn}</p>
                    <p className="text-[10px] text-muted-foreground">{dict.results.savePdf}</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadJson}
                  className="gap-2 border-border text-foreground hover:bg-secondary justify-center py-5"
                >
                  <Download className="w-4 h-4 text-primary" />
                  <div className="text-left">
                    <p className="text-xs font-medium leading-none">{dict.export.downloadJsonBtn}</p>
                    <p className="text-[10px] text-muted-foreground">JSON export</p>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
