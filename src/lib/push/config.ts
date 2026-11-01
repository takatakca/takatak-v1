// Push deal alerts: off until the owner sets a VAPID key pair (and the
// website leads workspace, where subscriptions are kept).

import { brand } from "@/lib/website/brand";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";

import { vapidKeysValid, type VapidKeys } from "./subscription";

export type PushConfig = { enabled: false; missing: string[] } | { enabled: true; clientId: string; vapid: VapidKeys };

export function readPushConfig(env: Record<string, string | undefined> = process.env): PushConfig {
  const leads = readWebsiteLeadsConfig(env);
  const publicKey = env.PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const missing: string[] = [];
  if (!leads.enabled) missing.push("WEBSITE_LEADS_ENABLED / WEBSITE_LEADS_CLIENT_ID");
  if (!vapidKeysValid({ publicKey, privateKey })) missing.push("PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY");
  if (missing.length || !leads.enabled) return { enabled: false, missing };
  return { enabled: true, clientId: leads.clientId, vapid: { publicKey, privateKey, subject: `mailto:${brand.supportEmail}` } };
}
