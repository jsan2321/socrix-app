"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/context";

export function AuthNav({ email, displayName }: { email?: string | null; displayName?: string | null }) {
  const router = useRouter();
  const { dict } = useI18n();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) menuRef.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!email || email.endsWith("@guest.socrix.internal")) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link href="/auth/login" className="text-foreground hover:text-primary transition-colors">{dict.nav.signIn}</Link>
        <Link href="/auth/register" className="inline-flex rounded-md border border-primary/25 px-2 py-1.5 text-primary transition-colors hover:bg-primary/10 sm:px-2.5">{dict.nav.createAccount}</Link>
      </div>
    );
  }

  async function signOut() {
    setError(null);
    setSigningOut(true);
    try {
      const { error: signOutError } = await createBrowserSupabaseClient().auth.signOut();
      if (signOutError) throw signOutError;
      if (menuRef.current) menuRef.current.open = false;
      router.replace("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  const label = displayName?.trim() || email.split("@")[0];
  return (
    <details ref={menuRef} className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden" aria-label={dict.nav.accountMenu}>
        <UserRound className="h-4 w-4" aria-hidden="true" />
        <span className="hidden max-w-24 truncate md:inline">{label}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg">
        <p className="truncate border-b border-border px-2 py-2 text-xs text-muted-foreground" title={email}>{email}</p>
        <Link href="/account" className="block rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => { if (menuRef.current) menuRef.current.open = false; }}>{dict.nav.profileSecurity}</Link>
        <button type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
          <LogOut className="h-4 w-4" aria-hidden="true" />{signingOut ? dict.nav.signingOut : dict.nav.signOut}
        </button>
        {error && <p role="alert" className="px-2 py-1 text-xs text-destructive">{error}</p>}
      </div>
    </details>
  );
}
