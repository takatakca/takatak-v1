// Phase 12 — Leads status labels + tones. Every "_internal" state is
// explicitly labeled so it never reads as real provider/outreach activity.

export const LEAD_SOURCE_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  active_internal: "Active (internal only)",
  paused: "Paused",
  disabled: "Disabled",
  archived: "Archived",
};

export const LEAD_CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  planned: "Planned",
  active_internal: "Active (internal only)",
  paused: "Paused",
  completed_internal: "Completed (internal only)",
  archived: "Archived",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new_internal: "New (internal only)",
  follow_up_planned: "Follow-up planned",
  contacted_internal: "Contacted (internal only)",
  qualified_internal: "Qualified (internal only)",
  proposal_planned: "Proposal planned",
  won_internal: "Won (internal only)",
  lost_internal: "Lost (internal only)",
  archived: "Archived",
};

export const LEAD_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PIPELINE_STAGE_STATUS_LABELS: Record<string, string> = {
  active_internal: "Active (internal only)",
  paused: "Paused",
  archived: "Archived",
};

export const LEAD_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  follow_up: "Follow-up",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  proposal: "Proposal",
  status_change: "Status change",
  internal_reminder: "Internal reminder",
};

export const LEAD_ACTIVITY_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  completed_internal: "Completed (internal only)",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const LEAD_SOURCE_TYPE_LABELS: Record<string, string> = {
  website_form: "Website form",
  social_media: "Social media",
  local_listing: "Local listing",
  referral: "Referral",
  phone_call: "Phone call",
  email: "Email",
  paid_ads: "Paid ads",
  flexs: "FLEXS",
  manual: "Manual/internal tracking",
  internal_demo: "Internal demo",
  future_provider: "Future provider",
};

export const LEAD_PROVIDER_LABELS: Record<string, string> = {
  flexs: "FLEXS",
  qmaps: "QMAPS",
  metricool: "Metricool",
  google_business: "Google Business",
  manual: "Manual/internal tracking",
  internal_demo: "Internal demo",
  future_provider: "Future provider",
};

export function leadToneForStatus(
  status: string,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "active_internal":
    case "qualified_internal":
    case "won_internal":
    case "completed_internal":
      return "success";
    case "lost_internal":
    case "urgent":
      return "danger";
    case "follow_up_planned":
    case "proposal_planned":
    case "high":
    case "paused":
      return "warning";
    case "new_internal":
    case "contacted_internal":
    case "planned":
    case "draft":
      return "accent";
    case "archived":
    case "disabled":
    case "cancelled":
    case "internal_demo":
    case "future_provider":
    case "low":
      return "muted";
    default:
      return "neutral"; // normal priority and unknown
  }
}
