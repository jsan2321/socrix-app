import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export const MAX_GUEST_UPLOADS = 3;
export const GUEST_USAGE_STORAGE_KEY = "socrix_guest_uploads";

export function getGuestUploadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    return Number(localStorage.getItem(GUEST_USAGE_STORAGE_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
}

export function incrementGuestUploadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const current = getGuestUploadCount();
    const next = current + 1;
    localStorage.setItem(GUEST_USAGE_STORAGE_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function isGuestUser(
  user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined
): boolean {
  if (!user) return false;
  if (user.user_metadata?.is_guest === true) return true;
  return Boolean(user.email?.endsWith("@guest.socrix.internal"));
}

/**
 * Ensures the browser has an active session. If not logged in, transparently
 * signs up an isolated guest identity so all RLS policies and table relations work.
 */
export async function ensureActiveSession() {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user;

  const guestId = Math.random().toString(36).substring(2, 9);
  const guestEmail = `guest_${guestId}_${Date.now()}@guest.socrix.internal`;
  const guestPassword = `Guest_${Math.random().toString(36).substring(2, 12)}!Aa1`;

  const { data, error } = await supabase.auth.signUp({
    email: guestEmail,
    password: guestPassword,
    options: {
      data: { is_guest: true, display_name: "Invitado" },
    },
  });

  if (error) throw error;
  return data.user;
}
