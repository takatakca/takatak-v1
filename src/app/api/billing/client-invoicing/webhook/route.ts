import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/social/stripe-client";
import { applyConnectAccountUpdated } from "@/lib/billing/client-invoicing/connect-service";
import { getClientConnectWebhookSecret } from "@/lib/billing/client-invoicing/env";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256_000;

// Client invoicing — Stripe Connect webhook ("events on connected accounts").
// Separate endpoint and secret from the platform Social webhook.
export async function POST(request: Request) {
  const secret = getClientConnectWebhookSecret();

  if (!secret) {
    return jsonResponse(
      { ok: false, message: "Stripe Connect webhooks are not configured." },
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

  if (event.type !== "account.updated") {
    return jsonResponse({ ok: true, processed: false }, 200);
  }

  try {
    const result = await applyConnectAccountUpdated(event);
    return jsonResponse({ ok: true, processed: result === "updated" }, 200);
  } catch (error) {
    console.error(
      "[client-invoicing-webhook] Apply failed:",
      error instanceof Error ? error.message : error,
    );
    return jsonResponse(
      { ok: false, message: "Stripe Connect webhook could not be applied." },
      500,
    );
  }
}

export function GET() {
  return jsonResponse({ ok: false, message: "Method not allowed." }, 405);
}
