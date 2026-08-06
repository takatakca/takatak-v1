// Phase 11 — Local listings status labels + tones. Internal-only states are
// explicitly labeled so they never read as real provider activity.

export const LISTING_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  draft: "Draft",
  pending_review: "Pending review",
  active_internal: "Active (internal only)",
  needs_update: "Needs update",
  error: "Error",
  archived: "Archived",
};

export const NAP_STATUS_LABELS: Record<string, string> = {
  unknown: "Unknown",
  consistent_internal: "Consistent (internal only)",
  needs_review: "Needs review",
  inconsistent: "Inconsistent",
  missing: "Missing",
};

export const CITATION_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  found_internal: "Found (internal only)",
  missing: "Missing",
  needs_update: "Needs update",
  error: "Error",
  archived: "Archived",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  internal_demo: "Internal demo",
  needs_review: "Needs review",
  archived: "Archived",
};

export const REPLY_STATUS_LABELS: Record<string, string> = {
  not_replied: "Not replied",
  draft_reply: "Draft reply",
  replied_internal: "Replied (internal only)",
  not_applicable: "Not applicable",
};

export const SENTIMENT_LABELS: Record<string, string> = {
  unknown: "Unknown",
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export const PHOTO_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  internal_demo: "Internal demo",
  needs_upload: "Needs upload",
  approved_internal: "Approved (internal only)",
  archived: "Archived",
};

export const LISTING_PROVIDER_LABELS: Record<string, string> = {
  qmaps: "QMAPS",
  google_business: "Google Business",
  manual: "Manual/internal tracking",
  internal_demo: "Internal demo",
  future_provider: "Future provider",
};

export const VISIBILITY_SOURCE_LABELS: Record<string, string> = {
  internal_foundation: "Internal foundation",
  qmaps: "QMAPS",
  google_business: "Google Business",
  manual: "Manual/internal tracking",
  future_provider: "Future provider",
};

export const LISTING_SOURCE_LABELS: Record<string, string> = {
  internal_demo: "Internal demo",
  manual: "Manual/internal tracking",
  qmaps: "QMAPS",
  google_business: "Google Business",
  provider_api: "Provider API",
  future_provider: "Future provider",
};

export function localToneForStatus(
  status: string,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "active_internal":
    case "consistent_internal":
    case "found_internal":
    case "approved_internal":
    case "positive":
      return "success";
    case "error":
    case "inconsistent":
    case "negative":
      return "danger";
    case "needs_update":
    case "needs_review":
    case "needs_upload":
    case "missing":
    case "pending_review":
    case "neutral":
      return "warning";
    case "planned":
    case "draft_reply":
      return "accent";
    case "archived":
    case "unknown":
    case "internal_demo":
    case "internal_foundation":
    case "future_provider":
    case "not_applicable":
      return "muted";
    default:
      return "neutral";
  }
}
