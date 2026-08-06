"use client";

// Browser Supabase client (anon key only — no service role in Phase 3).
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createSupabaseBrowserClient() {
  const env = getSupabaseEnv();
  if (!env) return null; // caller shows "Auth not configured"
  return createBrowserClient(env.url, env.anonKey);
}
