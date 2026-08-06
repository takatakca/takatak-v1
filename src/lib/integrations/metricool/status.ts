// Phase 6 — Metricool state labels + badge tones (matches ui/badge tones).
import type { MetricoolConnectionState } from "./types";

export const METRICOOL_STATE_LABELS: Record<MetricoolConnectionState, string> = {
  not_configured: "Not configured",
  configured_untested: "Configured — untested",
  connected: "Connected",
  error: "Error",
  disabled: "Disabled",
};

export function metricoolToneForState(
  state: MetricoolConnectionState,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (state) {
    case "connected":
      return "success";
    case "error":
      return "danger";
    case "not_configured":
    case "configured_untested":
      return "warning";
    case "disabled":
      return "muted";
    default:
      return "neutral";
  }
}
