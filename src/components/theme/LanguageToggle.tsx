"use client";

import * as React from "react";
import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";

export function LanguageToggle() {
  const { locale, setLocale, isSpanish, dict } = useI18n();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-9 px-2.5 text-xs font-mono font-medium text-muted-foreground gap-1.5"
        aria-label="Language"
      >
        <Languages className="w-3.5 h-3.5 opacity-50" />
        <span>EN</span>
      </Button>
    );
  }

  const toggleLanguage = () => {
    setLocale(isSpanish ? "en" : "es");
  };

  const nextLabel = isSpanish ? dict.nav.switchToEn : dict.nav.switchToEs;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 px-2.5 text-xs font-mono font-semibold text-muted-foreground hover:text-foreground transition-colors gap-1.5 select-none"
      onClick={toggleLanguage}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <Languages className="w-3.5 h-3.5 text-primary" />
      <span className="uppercase">{locale}</span>
    </Button>
  );
}
