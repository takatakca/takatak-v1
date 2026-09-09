// Phase 5 — Social status labels + tones + the post status transition map.
// The map is DISPLAYED in Phase 5; real transitions to scheduled/published
// require Metricool (Phase 6) and are not performed here.

export const POST_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
  blocked_by_plan: "Blocked by plan",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  cancelled: "Cancelled",
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  not_connected: "Not connected",
  pending_connection: "Pending connection",
  connected: "Connected",
  expired: "Expired",
  error: "Error",
  disabled: "Disabled",
};

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  google_business: "Google Business",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

/** Allowed post status transitions (source of truth for future phases). */
export const POST_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval"],
  pending_approval: ["approved", "draft"],
  approved: ["scheduled"],
  scheduled: ["published", "failed", "blocked_by_plan"],
  blocked_by_plan: ["scheduled"],
  published: [],
  failed: ["draft"],
};

export function canTransitionPost(from: string, to: string): boolean {
  return POST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Badge tone names matching src/components/ui/badge.tsx tones. */
export function socialToneForStatus(status: string): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "connected":
    case "approved":
    case "published":
    case "active":
    case "completed":
      return "success";
    case "error":
    case "failed":
    case "expired":
    case "rejected":
      return "danger";
    case "not_connected":
    case "pending_connection":
    case "pending_approval":
    case "pending":
    case "changes_requested":
      return "warning";
    case "planned":
    case "scheduled":
    case "blocked_by_plan":
      return "accent";
    case "disabled":
    case "cancelled":
    case "archived":
      return "muted";
    default:
      return "neutral"; // draft, paused, etc.
  }
}
