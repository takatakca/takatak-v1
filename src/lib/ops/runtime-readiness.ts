/**
 * The readiness endpoint is a traffic gate, not a development health badge.
 * Required services must be positively verified; a missing configuration is
 * never a successful production readiness state.
 */
export type RequiredReadinessState = "ok" | "unavailable" | "not_configured";

export function isRuntimeReady(
  checks: {
    database: RequiredReadinessState;
    supabase: RequiredReadinessState;
  },
): boolean {
  return checks.database === "ok" && checks.supabase === "ok";
}
