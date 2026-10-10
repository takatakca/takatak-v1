import "server-only";

// Outbound messaging for Growth Suite (review requests, alerts).
// Each channel is off unless its feature flag AND credentials are present.
// Provider endpoints follow official docs; the WhatsApp Graph API version is
// configured explicitly (never guessed). Secrets are never logged or returned.

import { getTwilioAccountSid, getTwilioAuthToken } from "@/lib/auth/otp/env";

const TIMEOUT_MS = 12_000;

export type DeliveryResult = { ok: true; providerMessageId: string | null } | { ok: false; reason: string };

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function growthSmsConfigured(): boolean {
  return (
    env("GROWTH_SMS_ENABLED") === "true" &&
    Boolean(getTwilioAccountSid() && getTwilioAuthToken()) &&
    Boolean(env("TWILIO_MESSAGING_SERVICE_SID") || env("TWILIO_SMS_FROM"))
  );
}

export function growthWhatsAppConfigured(): boolean {
  return (
    env("GROWTH_WHATSAPP_ENABLED") === "true" &&
    Boolean(env("WHATSAPP_PHONE_NUMBER_ID") && env("WHATSAPP_ACCESS_TOKEN") && env("WHATSAPP_REVIEW_TEMPLATE")) &&
    /^v\d{1,3}\.\d{1,2}$/.test(env("WHATSAPP_GRAPH_VERSION"))
  );
}

async function post(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
}

export async function sendGrowthSms(toE164: string, body: string): Promise<DeliveryResult> {
  if (!growthSmsConfigured()) return { ok: false, reason: "sms_not_configured" };
  const sid = getTwilioAccountSid();
  const token = getTwilioAuthToken();
  const form = new URLSearchParams({ To: toE164, Body: body });
  if (env("TWILIO_MESSAGING_SERVICE_SID")) form.set("MessagingServiceSid", env("TWILIO_MESSAGING_SERVICE_SID"));
  else form.set("From", env("TWILIO_SMS_FROM"));
  try {
    const response = await post(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!response.ok) return { ok: false, reason: `twilio_${response.status}` };
    const payload = (await response.json()) as { sid?: unknown };
    return { ok: true, providerMessageId: typeof payload.sid === "string" ? payload.sid : null };
  } catch {
    return { ok: false, reason: "twilio_unreachable" };
  }
}

/** Sends the approved review-request template with {{1}} = name, {{2}} = business, {{3}} = link. */
export async function sendWhatsAppReviewTemplate(
  toE164: string,
  params: { name: string; business: string; link: string },
): Promise<DeliveryResult> {
  if (!growthWhatsAppConfigured()) return { ok: false, reason: "whatsapp_not_configured" };
  const language = env("WHATSAPP_TEMPLATE_LANGUAGE") || "fr_CA";
  // WhatsApp rejects empty template parameters. Without a name, {{1}} reads
  // naturally after the greeting: "Bonjour à vous" / "Hi there".
  const name = params.name.trim() || (language.toLowerCase().startsWith("fr") ? "à vous" : "there");
  const url = `https://graph.facebook.com/${env("WHATSAPP_GRAPH_VERSION")}/${encodeURIComponent(env("WHATSAPP_PHONE_NUMBER_ID"))}/messages`;
  try {
    const response = await post(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164.replace(/^\+/, ""),
        type: "template",
        template: {
          name: env("WHATSAPP_REVIEW_TEMPLATE"),
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: name.slice(0, 60) },
                { type: "text", text: params.business.slice(0, 60) },
                { type: "text", text: params.link },
              ],
            },
          ],
        },
      }),
    });
    if (!response.ok) return { ok: false, reason: `whatsapp_${response.status}` };
    const payload = (await response.json()) as { messages?: Array<{ id?: unknown }> };
    const id = payload.messages?.[0]?.id;
    return { ok: true, providerMessageId: typeof id === "string" ? id : null };
  } catch {
    return { ok: false, reason: "whatsapp_unreachable" };
  }
}
