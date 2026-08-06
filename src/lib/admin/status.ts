// Phase 13 — Admin ops status labels + tones.

export const JOB_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const JOB_LOG_LEVEL_LABELS: Record<string, string> = {
  debug: "Debug",
  info: "Info",
  warning: "Warning",
  error: "Error",
};

export const EVENT_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  processed: "Processed",
  failed: "Failed",
  ignored: "Ignored (never processed)",
};

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  unread: "Unread",
  read: "Read",
  archived: "Archived",
};

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
  viewer: "Viewer",
};

export function adminToneForStatus(
  status: string,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "completed":
    case "processed":
    case "read":
    case "active":
      return "success";
    case "failed":
    case "error":
      return "danger";
    case "running":
    case "queued":
    case "warning":
    case "unread":
      return "warning";
    case "planned":
    case "received":
      return "accent";
    case "cancelled":
    case "ignored":
    case "archived":
    case "debug":
      return "muted";
    default:
      return "neutral";
  }
}
