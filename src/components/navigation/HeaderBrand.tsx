"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";

export function HeaderBrand() {
  const { dict } = useI18n();

  return (
    <div className="flex min-w-0 flex-col justify-center">
      <span className="font-serif font-bold text-xl tracking-tight text-foreground group-hover:text-primary transition-colors leading-none">
        {dict.nav.brandName}
      </span>
      <span className="hidden sm:inline-block text-[10px] font-sans uppercase tracking-widest font-semibold text-muted-foreground mt-0.5">
        {dict.nav.brandSubtitle}
      </span>
    </div>
  );
}
