"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/context";

export default function ForgotPasswordPage() {
  const { dict } = useI18n();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const { error: resetError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send a reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto mt-10 w-full max-w-md">
      <CardHeader><CardTitle className="font-serif text-3xl">{dict.auth.resetTitle}</CardTitle><CardDescription>{dict.auth.resetDesc}</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {sent ? <p role="status" className="text-sm text-foreground">{dict.auth.resetSent}</p> : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="reset-email">{dict.auth.emailLabel}</Label><Input id="reset-email" name="email" type="email" autoComplete="email" required /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? dict.auth.pleaseWait : dict.auth.sendResetLink}</Button>
          </form>
        )}
        <Link href="/auth/login" className="block text-center text-sm font-medium text-primary hover:underline">{dict.auth.backToSignIn}</Link>
      </CardContent>
    </Card>
  );
}
