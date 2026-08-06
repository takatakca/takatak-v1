// Phase 14 — Runtime mode resolution.
//
// The no-auth "foundation mode" is a development convenience. In a
// production runtime it must NOT silently expose the dashboard just because
// Supabase env vars are missing. The explicit TAKATAK_FOUNDATION_MODE_ENABLED
// override exists for controlled demos/QA only and is NOT production-safe.
import { isSupabaseConfigured } from "@/lib/auth/env";

export type RuntimeMode =
  | "development_foundation" // dev runtime, auth unconfigured — allowed with warning
  | "staging_configured"     // non-production runtime, auth configured
  | "production_configured"  // production runtime, auth configured
  | "production_blocked";    // production runtime, auth unconfigured, no override

export interface RuntimeInfo {
  mode: RuntimeMode;
  foundationAllowed: boolean;      // may the dashboard render without auth?
  foundationOverrideActive: boolean; // explicit unsafe production override in use
}

export function getRuntimeInfo(): RuntimeInfo {
  const isProduction = process.env.NODE_ENV === "production";
  const authConfigured = isSupabaseConfigured();

  if (authConfigured) {
    return {
      mode: isProduction ? "production_configured" : "staging_configured",
      foundationAllowed: false,
      foundationOverrideActive: false,
    };
  }
  if (!isProduction) {
    return { mode: "development_foundation", foundationAllowed: true, foundationOverrideActive: false };
  }
  if (process.env.TAKATAK_FOUNDATION_MODE_ENABLED === "true") {
    // Explicit, visible, documented-as-unsafe override (demos/QA only).
    return { mode: "development_foundation", foundationAllowed: true, foundationOverrideActive: true };
  }
  return { mode: "production_blocked", foundationAllowed: false, foundationOverrideActive: false };
}
