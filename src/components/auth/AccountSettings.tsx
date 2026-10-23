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

type Section = "name" | "email" | "password";

export function AccountSettings({ email, displayName }: { email: string; displayName: string }) {
  const router = useRouter();
  const { dict } = useI18n();
  const [name, setName] = useState(displayName);
  const [currentEmail] = useState(email);
  const [message, setMessage] = useState<{ section: Section; text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState<Section | null>(null);

  async function update(event: FormEvent<HTMLFormElement>, section: Section) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(section);
    setMessage(null);

    try {
      const supabase = createBrowserSupabaseClient();
      if (section === "name") {
        const updatedName = String(values.get("displayName") ?? "").trim();
        if (!updatedName) throw new Error("Enter a display name.");
        const { error } = await supabase.auth.updateUser({ data: { display_name: updatedName } });
        if (error) throw error;
        setName(updatedName);
        setMessage({ section, text: "Display name updated.", error: false });
        router.refresh();
      } else if (section === "email") {
        const newEmail = String(values.get("email") ?? "").trim();
        if (newEmail.toLowerCase() === currentEmail.toLowerCase()) throw new Error("Enter a different email address.");
        const { error } = await supabase.auth.updateUser({ email: newEmail });
        if (error) throw error;
        setMessage({ section, text: "Check your email to confirm this change. Your current address stays active until confirmation.", error: false });
      } else {
        const password = String(values.get("password") ?? "");
        const confirmation = String(values.get("confirmation") ?? "");
        if (password.length < 8) throw new Error("Use at least 8 characters.");
        if (password !== confirmation) throw new Error("The passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        form.reset();
        setMessage({ section, text: "Password updated.", error: false });
      }
    } catch (reason) {
      setMessage({ section, text: reason instanceof Error ? reason.message : "Could not save your changes.", error: true });
    } finally {
      setBusy(null);
    }
  }

  const feedback = (section: Section) => message?.section === section && (
    <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-destructive" : "text-primary"}`}>{message.text}</p>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">{dict.nav.account}</p>
        <h1 className="mt-2 font-serif text-4xl font-bold">{dict.auth.accountHeading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.auth.accountDesc}</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">{dict.auth.displayNameTitle}</CardTitle><CardDescription>{dict.auth.displayNameDesc}</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(event) => update(event, "name")} className="space-y-3">
            <Label htmlFor="profile-name">{dict.auth.nameLabel}</Label>
            <Input id="profile-name" name="displayName" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} required />
            {feedback("name")}
            <Button type="submit" disabled={busy !== null}>{dict.auth.saveNameBtn}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif">{dict.auth.emailTitle}</CardTitle><CardDescription>{dict.auth.currentAddress}: {currentEmail}</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(event) => update(event, "email")} className="space-y-3">
            <Label htmlFor="profile-email">{dict.auth.newEmailLabel}</Label>
            <Input id="profile-email" name="email" type="email" autoComplete="email" required />
            {feedback("email")}
            <Button type="submit" disabled={busy !== null}>{dict.auth.changeEmailBtn}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-serif">{dict.auth.passwordTitle}</CardTitle><CardDescription>{dict.auth.passwordDesc}</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(event) => update(event, "password")} className="space-y-3">
            <Label htmlFor="profile-password">{dict.auth.newPasswordLabel}</Label>
            <Input id="profile-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <Label htmlFor="profile-confirmation">{dict.auth.confirmPasswordLabel}</Label>
            <Input id="profile-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
            {feedback("password")}
            <Button type="submit" disabled={busy !== null}>{dict.auth.updatePasswordBtn}</Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">{dict.auth.forgotPassword} <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">{dict.auth.sendResetLink}</Link>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
