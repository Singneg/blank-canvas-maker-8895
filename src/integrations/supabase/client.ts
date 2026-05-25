/**
 * Browser-side Supabase client.
 * Uses the publishable (anon) key. RLS protects all data — this key is safe in the bundle.
 * Points to LÉO MORAES BARBER's own Supabase project (NOT Lovable Cloud).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wvqvndxchoqpwxbvwzhv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_oN35sS8oZRxVJ9qXkJm0ug_odrWQKCH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
