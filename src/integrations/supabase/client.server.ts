/**
 * SERVER-ONLY Supabase admin client.
 * Uses the SERVICE ROLE key — bypasses RLS. NEVER import this in client code.
 * Reads credentials from server-side environment variables (LMB_* secrets).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.LMB_SUPABASE_URL;
  const serviceKey = process.env.LMB_SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("LMB_SUPABASE_URL is not configured");
  if (!serviceKey) throw new Error("LMB_SUPABASE_SERVICE_ROLE_KEY is not configured");

  cached = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
