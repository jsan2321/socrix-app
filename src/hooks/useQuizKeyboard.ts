import { useEffect } from "react";

export interface UseQuizKeyboardOptions {
  enabled?: boolean;
  statementIds: string[];
  onToggleStatement: (statementId: string) => void;
  onSetConfidence: (level: number) => void;
  onSubmitAnswer: () => void;
  onNextQuestion: () => void;
  onToggleEvidence?: () => void;
  onToggleHelp: () => void;
  isSubmitted: boolean;
  canSubmit: boolean;
}

export function useQuizKeyboard({
  enabled = true,
  statementIds,
  onToggleStatement,
  onSetConfidence,
  onSubmitAnswer,
  onNextQuestion,
  onToggleEvidence,
  onToggleHelp,
  isSubmitted,
  canSubmit,
}: UseQuizKeyboardOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't intercept when focusing text inputs
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = event.key;

      // '?' toggles shortcut cheat sheet
      if (key === "?" || (key === "/" && event.shiftKey)) {
        event.preventDefault();
        onToggleHelp();
        return;
      }

      // Pre-submission interactions
      if (!isSubmitted) {
        // Statement selection via A, B, C
        if (key === "a" || key === "A") {
          if (statementIds[0]) {
            event.preventDefault();
            onToggleStatement(statementIds[0]);
          }
          return;
        }
        if (key === "b" || key === "B") {
          if (statementIds[1]) {
            event.preventDefault();
            onToggleStatement(statementIds[1]);
          }
          return;
        }
        if (key === "c" || key === "C") {
          if (statementIds[2]) {
            event.preventDefault();
            onToggleStatement(statementIds[2]);
          }
          return;
        }

        // Confidence selection via 1–5
        if (["1", "2", "3", "4", "5"].includes(key)) {
          event.preventDefault();
          onSetConfidence(parseInt(key, 10));
          return;
        }

        // Submit via Enter
        if (key === "Enter" && canSubmit) {
          event.preventDefault();
          onSubmitAnswer();
          return;
        }
      } else {
        // Post-submission interactions
        // Next question via Enter or 'N'
        if (key === "Enter" || key === "n" || key === "N") {
          event.preventDefault();
          onNextQuestion();
          return;
        }

        // Toggle evidence via 'E'
        if ((key === "e" || key === "E") && onToggleEvidence) {
          event.preventDefault();
          onToggleEvidence();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    statementIds,
    onToggleStatement,
    onSetConfidence,
    onSubmitAnswer,
    onNextQuestion,
    onToggleEvidence,
    onToggleHelp,
    isSubmitted,
    canSubmit,
  ]);
}
