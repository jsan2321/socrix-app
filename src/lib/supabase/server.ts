import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { ConfigurationError } from "@/lib/errors";

/** Creates a cookie-aware Supabase client for Server Components and route handlers. */
export async function createServerSupabaseClient() {
  if (!config.SUPABASE_ANON_KEY) {
    throw new ConfigurationError("SUPABASE_ANON_KEY is required for Supabase authentication");
  }
  const cookieStore = await cookies();

  return createServerClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies; middleware refreshes sessions instead.
        }
      },
    },
  });
}
