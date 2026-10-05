import type Stripe from "stripe";

import { getHockeyStripe } from "@/lib/billing/hockey/stripe-client";
import { getHockeyStripeWebhookSecret } from "@/lib/billing/hockey/stripe-env";
import { applyHockeyStripeWebhookEvent } from "@/lib/billing/hockey/stripe-webhook-apply";
import { deferProviderWebhook } from "@/lib/queue/signal";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;

export async function POST(request: Request) {
  const secret = getHockeyStripeWebhookSecret();
  if (!secret) {
    return jsonResponse(
      { ok: false, message: "Hockey Stripe webhooks are not configured." },
      503,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, message: "Payload too large." }, 413);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ ok: false, message: "Missing Stripe signature." }, 400);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, message: "Payload too large." }, 413);
  }

  let event: Stripe.Event;
  try {
    event = getHockeyStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return jsonResponse({ ok: false, message: "Invalid Stripe signature." }, 400);
  }

  const deferred = await deferProviderWebhook({
    workspaceId: null,
    connectionId: null,
    provider: "stripe_hockey",
    eventId: event.id,
  });
  if (deferred) {
    return jsonResponse(
      {
        ok: true,
        processed: false,
        duplicate: false,
        skipped: false,
        queued: true,
      },
      200,
    );
  }

  try {
    const result = await applyHockeyStripeWebhookEvent(event);
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
      "[hockey-stripe-webhook] Apply failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return jsonResponse(
      { ok: false, message: "Hockey Stripe webhook could not be applied." },
      500,
    );
  }
}

export function GET() {
  return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
}
