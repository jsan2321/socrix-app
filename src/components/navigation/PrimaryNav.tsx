"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, PlusCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";

export function PrimaryNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const { dict } = useI18n();

  if (!authenticated) return null;

  const showNewSession = pathname === "/account" || pathname.startsWith("/quiz/") || pathname.startsWith("/results/");

  return (
    <>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:text-primary"
        aria-label={dict.nav.dashboard}
        aria-current={pathname === "/dashboard" ? "page" : undefined}
      >
        <Library className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">{dict.nav.dashboard}</span>
      </Link>
      {showNewSession && (
        <Link
          href="/upload"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-2.5 py-1.5 text-sm font-medium text-foreground shadow-sm transition-all hover:bg-secondary sm:px-3.5"
          aria-label={dict.nav.newSession}
        >
          <PlusCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="hidden sm:inline">{dict.nav.newSession}</span>
        </Link>
      )}
    </>
  );
}
