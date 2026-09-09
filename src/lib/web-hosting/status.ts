// Phase 7 — Web/hosting status labels + badge tones.
// "active_internal" and "completed_internal" are explicitly labeled as
// internal so they can never read as real provider activity.

export const DOMAIN_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  pending_connection: "Pending connection",
  tracked: "Tracked",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const DNS_STATUS_LABELS: Record<string, string> = {
  unknown: "Unknown",
  not_configured: "Not configured",
  pending: "Pending",
  valid: "Valid",
  warning: "Warning",
  error: "Error",
};

export const SSL_STATUS_LABELS: Record<string, string> = {
  unknown: "Unknown",
  not_configured: "Not configured",
  planned: "Planned",
  pending: "Pending",
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  error: "Error",
};

export const HOSTING_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  pending_setup: "Pending setup",
  active_internal: "Active (internal)",
  paused: "Paused",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const SERVER_STATUS_LABELS: Record<string, string> = {
  unknown: "Unknown",
  pending: "Pending",
  healthy: "Healthy",
  warning: "Warning",
  error: "Error",
};

export const PROVISIONING_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  pending: "Pending",
  in_progress: "In progress",
  completed_internal: "Completed (internal)",
  failed: "Failed",
  skipped: "Skipped",
};

export const DNS_RECORD_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  pending: "Pending",
  valid: "Valid",
  warning: "Warning",
  error: "Error",
};

export const WEB_SOURCE_LABELS: Record<string, string> = {
  internal_demo: "Internal demo",
  upmind: "TAKATAK",
  manual: "Manual",
  provider_api: "Provider API",
};

export function webToneForStatus(
  status: string,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "valid":
    case "healthy":
    case "tracked":
    case "completed_internal":
    case "active_internal":
      return "success";
    case "error":
    case "expired":
    case "failed":
      return "danger";
    case "pending":
    case "pending_connection":
    case "pending_setup":
    case "expiring_soon":
    case "warning":
    case "not_configured":
      return "warning";
    case "planned":
    case "in_progress":
      return "accent";
    case "cancelled":
    case "skipped":
    case "paused":
    case "unknown":
      return "muted";
    default:
      return "neutral";
  }
}
