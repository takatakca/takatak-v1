import type Stripe from "stripe";

import { getAiCreditsStripe } from "@/lib/billing/ai-credits/stripe";
import { applyGrowthStripeEvent, growthWebhookSecret } from "@/lib/billing/growth/stripe";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;

export async function POST(request: Request) {
  const secret = growthWebhookSecret();
  if (!secret) return jsonResponse({ ok: false, message: "Growth billing webhooks are not configured." }, 503);
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return jsonResponse({ ok: false, message: "Payload too large." }, 413);
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
    const outcome = await applyGrowthStripeEvent(event);
    return jsonResponse({ ok: true, ...outcome }, 200);
  } catch (error) {
    console.error("[growth-billing-webhook] apply failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ ok: false, message: "Growth billing webhook could not be applied." }, 500);
  }
}

export function GET() {
  return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
}
