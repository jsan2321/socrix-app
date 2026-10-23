"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useI18n } from "@/lib/i18n/context";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/dashboard";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dict } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";
  const next = safeNext(searchParams.get("next"));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const displayName = String(form.get("displayName") ?? "").trim();

    try {
      const supabase = createBrowserSupabaseClient();
      const result = isRegister
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: displayName ? { display_name: displayName } : undefined,
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (isRegister && !result.data.session) {
        setNotice(dict.auth.checkEmailConfirm);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : dict.auth.couldNotSignIn);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto mt-10 w-full max-w-md border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-3xl">{isRegister ? dict.auth.createAccount : dict.auth.welcomeBack}</CardTitle>
        <CardDescription>{isRegister ? dict.auth.registerDesc : dict.auth.loginDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          {isRegister && <div className="space-y-2"><Label htmlFor="displayName">{dict.auth.displayNameLabel}</Label><Input id="displayName" name="displayName" autoComplete="name" maxLength={80} /></div>}
          <div className="space-y-2"><Label htmlFor="email">{dict.auth.emailLabel}</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="space-y-2"><Label htmlFor="password">{dict.auth.passwordLabel}</Label><Input id="password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} required /></div>
          {!isRegister && <Link href="/auth/forgot-password" className="block text-right text-sm font-medium text-primary hover:underline">{dict.auth.forgotPassword}</Link>}
          {(error || searchParams.get("error") === "callback") && <p role="alert" className="text-sm text-destructive">{error || dict.auth.linkExpired}</p>}
          {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? dict.auth.pleaseWait : isRegister ? dict.auth.registerBtn : dict.auth.signInBtn}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {isRegister ? `${dict.auth.alreadyAccount} ` : `${dict.auth.newHere} `}
          <Link className="font-medium text-primary hover:underline" href={isRegister ? `/auth/login?next=${encodeURIComponent(next)}` : `/auth/register?next=${encodeURIComponent(next)}`}>
            {isRegister ? dict.auth.signInBtn : dict.auth.createAccount}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
