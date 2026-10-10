import "server-only";

// Internal alert to the TAKATAK team when a website lead arrives. Goes only to
// the configured WEBSITE_LEADS_NOTIFY_EMAIL (never to the visitor) and carries
// no contact details: staff open the lead in the dashboard.

import { sendModeratorEmail, type ModeratorEmailResult } from "@/lib/contributions/moderator-email";

import { notificationTitle } from "./store";
import type { WebsiteRequestKind } from "./validation";

export function leadAlertEmail(input: {
  kind: WebsiteRequestKind;
  reference: string;
  summary: string;
  dashboardOrigin: string;
}): { subject: string; text: string } {
  const title = notificationTitle(input.kind);
  return {
    subject: `[takatak.ca] ${title} · ${input.reference}`,
    text: [
      `${title} from the takatak.ca website.`,
      "",
      input.summary,
      "",
      `Open the leads inbox: ${input.dashboardOrigin}/dashboard/leads/inbox`,
      "Contact details are in the dashboard only.",
    ].join("\n"),
  };
}

export async function sendLeadAlert(input: {
  to: string;
  kind: WebsiteRequestKind;
  reference: string;
  summary: string;
  dashboardOrigin: string;
}): Promise<ModeratorEmailResult> {
  const email = leadAlertEmail(input);
  return sendModeratorEmail({ to: input.to, ...email, fromName: "TAKATAK Website" });
}
