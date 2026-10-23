"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export function AppFooter() {
  const { dict } = useI18n();

  return (
    <footer className="border-t border-border bg-muted/20 py-6 text-xs text-muted-foreground">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span>{dict.footer.platformTag}</span>
        </div>
        <span className="font-sans">{dict.footer.builtWith}</span>
      </div>
    </footer>
  );
}
