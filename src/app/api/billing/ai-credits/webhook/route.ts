import type Stripe from "stripe";

import { aiCreditsWebhookSecret, applyAiCreditsStripeEvent, getAiCreditsStripe } from "@/lib/billing/ai-credits/stripe";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;

export async function POST(request: Request) {
  const secret = aiCreditsWebhookSecret();
  if (!secret) return jsonResponse({ ok: false, message: "AI credit webhooks are not configured." }, 503);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, message: "Payload too large." }, 413);
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonResponse({ ok: false, message: "Missing Stripe signature." }, 400);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return jsonResponse({ ok: false, message: "Payload too large." }, 413);

  let event: Stripe.Event;
  try {
    event = getAiCreditsStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return jsonResponse({ ok: false, message: "Invalid Stripe signature." }, 400);
  }

  try {
    const outcome = await applyAiCreditsStripeEvent(event);
    if (outcome.result && !outcome.result.ok) {
      console.error("[ai-credits-webhook] grant refused:", outcome.result.code);
      return jsonResponse({ ok: false, message: "Credit grant refused." }, 500);
    }
    return jsonResponse({ ok: true, applied: outcome.applied, reason: outcome.reason ?? null }, 200);
  } catch (error) {
    console.error("[ai-credits-webhook] apply failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ ok: false, message: "AI credit webhook could not be applied." }, 500);
  }
}

export function GET() {
  return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
}
