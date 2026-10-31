import "server-only";

import { isGmailSmtpConfigured, isSendgridConfigured } from "@/lib/auth/otp/env";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { sendModeratorEmail, type ModeratorEmailResult } from "@/lib/contributions/moderator-email";

import { confirmationEmail, signToken, type Lang, type NewsletterSender } from "./consent";
import { readNewsletterConfig, type NewsletterConfig } from "./config";

/** Ready only with the full config and a way to send the confirmation email. */
export function newsletterReady(): NewsletterConfig {
  const config = readNewsletterConfig();
  if (!config.enabled) return config;
  if (!isSendgridConfigured() && !isGmailSmtpConfigured()) {
    return { enabled: false, missing: ["SENDGRID_API_KEY or Gmail SMTP"] };
  }
  return config;
}

export function newsletterLinks(id: string, secret: string): { confirm: string; unsubscribe: string } {
  const origin = getApplicationOrigin();
  return {
    confirm: `${origin}/infolettre/confirmer?t=${encodeURIComponent(signToken("confirm", id, secret))}`,
    unsubscribe: `${origin}/infolettre/desabonnement?t=${encodeURIComponent(signToken("unsubscribe", id, secret))}`,
  };
}

export async function sendConfirmation(input: {
  to: string;
  id: string;
  lang: Lang;
  sender: NewsletterSender;
  secret: string;
}): Promise<ModeratorEmailResult> {
  const links = newsletterLinks(input.id, input.secret);
  const email = confirmationEmail(input.lang, input.sender, links.confirm, links.unsubscribe);
  return sendModeratorEmail({ to: input.to, ...email, fromName: input.sender.name });
}
