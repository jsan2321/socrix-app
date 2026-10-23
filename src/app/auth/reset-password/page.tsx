"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/context";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { dict } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const confirmation = String(values.get("confirmation") ?? "");
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("This reset link expired. Request a new one.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      form.reset();
      setSaved(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto mt-10 w-full max-w-md">
      <CardHeader><CardTitle className="font-serif text-3xl">{dict.auth.chooseNewPassword}</CardTitle><CardDescription>{dict.auth.passwordDesc}</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        {saved ? <p role="status" className="text-sm text-primary">{dict.auth.passwordResetSuccess}</p> : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="reset-password">{dict.auth.newPasswordLabel}</Label><Input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
            <div className="space-y-2"><Label htmlFor="reset-confirmation">{dict.auth.confirmPasswordLabel}</Label><Input id="reset-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? dict.auth.saving : dict.auth.savePassword}</Button>
          </form>
        )}
        <Link href={saved ? "/dashboard" : "/auth/forgot-password"} className="block text-center text-sm font-medium text-primary hover:underline">{saved ? dict.auth.goToDashboard : dict.auth.requestAnotherLink}</Link>
      </CardContent>
    </Card>
  );
}
