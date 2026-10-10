import "server-only";

import Stripe from "stripe";

import { grantCredits, type LedgerResult } from "@/lib/ai-credits/ledger";
import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";
import { AI_CREDIT_PACKS } from "@/lib/growth/ai-engine";

import { AI_CREDITS_BILLING_DOMAIN, decideCreditGrant } from "./policy";

const globalForStripe = globalThis as unknown as { aiCreditsStripe?: Stripe };

/** Checkout stays off until the owner confirms pack prices and turns it on. */
export function aiCreditsCheckoutEnabled(): boolean {
  return process.env.AI_CREDITS_CHECKOUT_ENABLED === "true" && Boolean(getStripeSecretKey());
}

export function aiCreditsWebhookSecret(): string {
  return process.env.STRIPE_AI_CREDITS_WEBHOOK_SECRET?.trim() ?? "";
}

export function getAiCreditsStripe(): Stripe {
  const secret = getStripeSecretKey();
  if (!secret) throw new Error("stripe_not_configured");
  if (!globalForStripe.aiCreditsStripe) globalForStripe.aiCreditsStripe = new Stripe(secret);
  return globalForStripe.aiCreditsStripe;
}

export async function startCreditCheckout(input: { clientId: string; packKey: string; origin: string }): Promise<string> {
  const pack = AI_CREDIT_PACKS.find((p) => p.key === input.packKey);
  if (!pack) throw new Error("unknown_pack");
  const session = await getAiCreditsStripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.clientId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: Math.round(pack.priceCad * 100),
          product_data: { name: `TAKATAK AI credits — ${pack.label} (${pack.credits.toLocaleString("en-CA")})` },
        },
      },
    ],
    metadata: { billingDomain: AI_CREDITS_BILLING_DOMAIN, clientId: input.clientId, packKey: pack.key, credits: String(pack.credits) },
    payment_intent_data: { metadata: { billingDomain: AI_CREDITS_BILLING_DOMAIN, clientId: input.clientId, packKey: pack.key } },
    success_url: `${input.origin}/dashboard/growth/ai-engine?credits=success`,
    cancel_url: `${input.origin}/dashboard/growth/ai-engine?credits=canceled`,
  });
  if (!session.url) throw new Error("stripe_no_url");
  return session.url;
}

export async function applyAiCreditsStripeEvent(event: Stripe.Event): Promise<{ applied: boolean; reason?: string; result?: LedgerResult }> {
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return { applied: false, reason: "ignored_event" };
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const decision = decideCreditGrant({
    id: session.id,
    mode: session.mode,
    payment_status: session.payment_status,
    currency: session.currency,
    amount_total: session.amount_total,
    client_reference_id: session.client_reference_id,
    metadata: session.metadata,
  });
  if (!decision.grant) return { applied: false, reason: decision.reason };
  const result = await grantCredits({
    clientId: decision.clientId,
    credits: decision.credits,
    reason: "purchase",
    idempotencyKey: decision.idempotencyKey,
    note: `Stripe ${decision.packKey} pack`,
  });
  return { applied: result.ok, result };
}
