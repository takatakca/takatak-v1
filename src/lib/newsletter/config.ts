// Newsletter configuration. Off until the owner sets all of it: the website
// leads workspace (WEBSITE_LEADS_ENABLED + WEBSITE_LEADS_CLIENT_ID), a signing
// secret for the confirm / unsubscribe links, and the mailing address CASL
// requires in the consent request and in every message.

import { brand } from "@/lib/website/brand";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";

import type { NewsletterSender } from "./consent";

/** Public business name (owner's entity rule: Groupe TAKATAK everywhere public). */
export const NEWSLETTER_SENDER_NAME = "Groupe TAKATAK";

export type NewsletterConfig =
  | { enabled: false; missing: string[] }
  | { enabled: true; clientId: string; secret: string; sender: NewsletterSender };

export function readNewsletterConfig(env: Record<string, string | undefined> = process.env): NewsletterConfig {
  const leads = readWebsiteLeadsConfig(env);
  const secret = env.NEWSLETTER_TOKEN_SECRET?.trim() ?? "";
  const address = env.NEWSLETTER_SENDER_ADDRESS?.trim().replace(/\s+/g, " ") ?? "";
  const missing: string[] = [];
  if (!leads.enabled) missing.push("WEBSITE_LEADS_ENABLED / WEBSITE_LEADS_CLIENT_ID");
  if (secret.length < 32) missing.push("NEWSLETTER_TOKEN_SECRET");
  if (address.length < 10 || address.length > 200) missing.push("NEWSLETTER_SENDER_ADDRESS");
  if (missing.length || !leads.enabled) return { enabled: false, missing };
  return {
    enabled: true,
    clientId: leads.clientId,
    secret,
    sender: { name: NEWSLETTER_SENDER_NAME, address, email: brand.supportEmail, web: brand.domain },
  };
}

/**
 * What confirm / unsubscribe links need. Looser than the sign-up config on
 * purpose: unsubscribing keeps working even if sign-ups are switched off.
 */
export function readNewsletterLinkConfig(
  env: Record<string, string | undefined> = process.env,
): { clientId: string; secret: string } | null {
  const leads = readWebsiteLeadsConfig(env);
  const secret = env.NEWSLETTER_TOKEN_SECRET?.trim() ?? "";
  if (!leads.enabled || secret.length < 32) return null;
  return { clientId: leads.clientId, secret };
}
