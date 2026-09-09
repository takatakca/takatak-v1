import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/social/stripe-client";
import { getStripeWebhookSecret } from "@/lib/billing/social/stripe-env";
import { applySocialStripeWebhookEvent } from "@/lib/billing/social/stripe-webhook-apply";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();

  if (!secret) {
    return jsonResponse(
      { ok: false, message: "Stripe webhooks are not configured." },
      503,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, message: "Payload too large." }, 413);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse(
      { ok: false, message: "Missing Stripe signature." },
      400,
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, message: "Payload too large." }, 413);
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return jsonResponse(
      { ok: false, message: "Invalid Stripe signature." },
      400,
    );
  }

  try {
    const result = await applySocialStripeWebhookEvent(event);
    return jsonResponse(
      {
        ok: true,
        processed: result.processed,
        duplicate: result.duplicate,
        skipped: result.skipped,
        reason: result.reason,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[stripe-webhook] Apply failed:",
      error instanceof Error ? error.message : error,
    );
    return jsonResponse(
      { ok: false, message: "Stripe webhook could not be applied." },
      500,
    );
  }
}

export function GET() {
  return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
}
