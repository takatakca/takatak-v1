// Phase 8 — Upmind state labels + badge tones.
import type { UpmindConnectionState } from "./types";

export const UPMIND_STATE_LABELS: Record<UpmindConnectionState, string> = {
  not_configured: "Not configured",
  configured_untested: "Configured — untested",
  connected: "Connected",
  error: "Error",
  disabled: "Disabled",
};

export const UPMIND_STATE_MESSAGES: Record<UpmindConnectionState, string> = {
  not_configured: "Upmind credentials required.",
  configured_untested: "Credentials detected, live API test endpoint not confirmed.",
  connected: "Upmind connection verified.",
  error: "Last Upmind test failed safely.",
  disabled: "Upmind integration disabled.",
};

export function upmindToneForState(
  state: UpmindConnectionState,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (state) {
    case "connected": return "success";
    case "error": return "danger";
    case "not_configured":
    case "configured_untested": return "warning";
    case "disabled": return "muted";
    default: return "neutral";
  }
}
