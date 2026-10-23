"use client";

import React, { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useI18n } from "@/lib/i18n/context";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { dict } = useI18n();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      keys: ["A", "B", "C"],
      label: dict.quiz.shortcutSelectStmt,
    },
    {
      keys: ["1", "2", "3", "4", "5"],
      label: dict.quiz.shortcutConfidence,
    },
    {
      keys: ["Enter"],
      label: dict.quiz.shortcutSubmit,
    },
    {
      keys: ["N", "Enter"],
      label: dict.quiz.shortcutNext,
    },
    {
      keys: ["E"],
      label: dict.quiz.shortcutEvidence,
    },
    {
      keys: ["?"],
      label: dict.quiz.shortcutToggleHelp,
    },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
        <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl z-10 text-card-foreground p-6 space-y-5"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Keyboard className="h-4 w-4" />
              </div>
              <div>
                <h2 id="shortcuts-modal-title" className="text-base font-serif font-bold text-foreground">
                  {dict.quiz.shortcutsTitle}
                </h2>
                <p className="text-xs text-muted-foreground">{dict.quiz.shortcutsSubtitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label={dict.quiz.closeShortcuts}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Shortcut Rows */}
          <div className="space-y-3 pt-1">
            {shortcuts.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <div className="flex items-center gap-1.5">
                  {item.keys.map((k, kIdx) => (
                    <kbd
                      key={kIdx}
                      className="px-2 py-1 min-w-[24px] text-center text-[11px] font-mono font-bold text-foreground bg-muted border border-border rounded shadow-xs"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="pt-2 text-center">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="w-full text-xs"
            >
              {dict.quiz.closeShortcuts}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
