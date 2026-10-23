import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

let supabaseAdminClientInstance: SupabaseClient | null = null;
let supabaseClientInstance: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured with the Service Role Key for server-side administrative operations.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!supabaseAdminClientInstance) {
    supabaseAdminClientInstance = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return supabaseAdminClientInstance;
}

/**
 * Returns a standard Supabase client using the anon key when available.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    const key = config.SUPABASE_ANON_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
    supabaseClientInstance = createClient(config.SUPABASE_URL, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClientInstance;
}
