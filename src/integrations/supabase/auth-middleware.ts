/**
 * Server function middleware that authenticates the caller against the user's own Supabase project.
 * Provides an authenticated supabase client (RLS applies as that user) + userId.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const url = process.env.LMB_SUPABASE_URL;
    const anon = process.env.LMB_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !anon) throw new Error("Supabase env not configured");

    const authHeader = getRequestHeader("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: missing bearer token");
    }

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Unauthorized: invalid token");

    return next({
      context: {
        supabase,
        userId: data.user.id,
        userEmail: data.user.email,
      },
    });
  },
);
