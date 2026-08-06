// Phase 10 — Reporting status labels + tones. Internal-only states are
// explicitly labeled so they can never read as real delivery/sharing.

export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready for internal review",
  sent: "Sent",
  archived: "Archived",
};

export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const SECTION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  hidden: "Hidden",
};

export const SECTION_TYPE_LABELS: Record<string, string> = {
  summary: "Summary",
  metrics: "Metrics",
  chart_placeholder: "Chart placeholder",
  social_posts: "Social posts",
  campaign_performance: "Campaign performance",
  hosting_status: "Hosting status",
  domain_status: "Domain status",
  leads_summary: "Leads summary",
  recommendations: "Recommendations",
  notes: "Notes",
};

export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  active_internal: "Active (internal only)",
  paused: "Paused",
  archived: "Archived",
};

export const SCHEDULE_FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  manual: "Manual",
};

export const SHARE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_to_share: "Ready to share",
  shared_internal: "Shared (internal only)",
  revoked: "Revoked",
};

export const METRIC_SOURCE_LABELS: Record<string, string> = {
  internal: "Internal",
  social_foundation: "Social foundation",
  web_hosting_foundation: "Web/hosting foundation",
  ai_foundation: "AI foundation",
  manual: "Manual",
  future_provider: "Future provider",
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  social_media: "Social media",
  web_hosting: "Web / hosting",
  local_listings: "Local listings",
  leads: "Leads",
  monthly_business: "Monthly business",
  client_summary: "Client summary",
};

export const REPORT_PERIOD_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  custom: "Custom",
};

export function reportToneForStatus(
  status: string,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "ready":
    case "active":
      return "success";
    case "sent":
    case "shared_internal":
    case "ready_to_share":
    case "active_internal":
    case "planned":
      return "accent";
    case "paused":
    case "hidden":
      return "warning";
    case "archived":
    case "revoked":
    case "future_provider":
      return "muted";
    default:
      return "neutral"; // draft and unknown
  }
}
