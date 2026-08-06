// Phase 9 — AI Studio status labels + tones.
import type { AiProviderState } from "./types";

export const AI_PROVIDER_STATE_LABELS: Record<AiProviderState, string> = {
  not_configured: "Not configured",
  configured_untested: "Configured — untested",
  connected: "Connected",
  error: "Error",
  disabled: "Disabled",
};

export const AI_KIND_LABELS: Record<string, string> = {
  caption: "Caption",
  hashtags: "Hashtags",
  hook: "Hook",
  cta: "CTA",
  post_long: "Long post",
  campaign_plan: "Campaign plan",
  video_idea: "Video idea",
  video_script: "Video script",
  creative_brief: "Creative brief",
  report_summary: "Report summary",
};

export const AI_ORIGIN_LABELS: Record<string, string> = {
  foundation_template: "Foundation template — not AI",
  manual: "Manual",
  ai_generated: "AI generated",
};

export const AI_JOB_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const AI_OUTPUT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  saved: "Saved",
  sent_to_approval: "Sent to approval",
  archived: "Archived",
};

export function aiToneForStatus(
  status: string,
): "neutral" | "accent" | "warning" | "muted" | "success" | "danger" {
  switch (status) {
    case "connected":
    case "completed":
    case "ai_generated":
      return "success";
    case "error":
    case "failed":
      return "danger";
    case "not_configured":
    case "configured_untested":
      return "warning";
    case "planned":
    case "queued":
    case "running":
    case "sent_to_approval":
      return "accent";
    case "disabled":
    case "cancelled":
    case "archived":
    case "foundation_template":
      return "muted";
    default:
      return "neutral";
  }
}
