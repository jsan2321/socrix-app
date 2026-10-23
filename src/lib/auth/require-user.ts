import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";

/** Returns true only when AUTH_TEST_BYPASS is enabled in a non-production environment. */
export function isTestAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_TEST_BYPASS === "true";
}

/** Returns the current verified Supabase user or a normalized 401 API error. */
export async function requireAuthenticatedUser() {
  // Route tests exercise domain behavior without a hosted Supabase Auth instance.
  if (isTestAuthBypassEnabled()) {
    return { id: "00000000-0000-4000-8000-000000000001", email: "test@example.com" };
  }
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new UnauthorizedError();
  return user;
}

/** Safe for shared server UI where an anonymous visitor is expected. */
export async function getOptionalAuthenticatedUser() {
  // Public pages remain renderable before Auth is configured (for example, preview builds).
  if (!config.SUPABASE_ANON_KEY) return null;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Avoids leaking whether a document/session belongs to another account. */
export function requireResourceOwner(ownerId: string | null | undefined, userId: string, resource: string) {
  if (!isTestAuthBypassEnabled() && ownerId !== userId) {
    throw new NotFoundError(`${resource} not found`);
  }
}
