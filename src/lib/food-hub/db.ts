import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Food Hub data lives in its own `foodhub` schema inside the shared TAKATAK
// Supabase project (same pattern as Rentauto). Only the server-side service
// role can read or write it: anon/authenticated have no grants and RLS is on.
// Same env names as src/lib/auth/supabase-admin.ts, so no new secret is needed.

function environment(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !loopback) return null;
  } catch {
    return null;
  }
  return { url, key };
}

export function hasFoodHubDatabase(): boolean {
  return environment() !== null;
}

const globalForFoodHub = globalThis as unknown as { foodHubDb?: SupabaseClient<any, "foodhub", any> };

export function foodHubDb(): SupabaseClient<any, "foodhub", any> {
  const env = environment();
  if (!env) throw new Error("Food Hub database is not configured (Supabase URL and server key).");
  if (!globalForFoodHub.foodHubDb) {
    globalForFoodHub.foodHubDb = createClient<any, "foodhub", any>(env.url, env.key, {
      db: { schema: "foodhub" },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
  }
  return globalForFoodHub.foodHubDb;
}
