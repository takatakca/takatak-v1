import "server-only";

import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { grantCredits } from "@/lib/ai-credits/ledger";
import { getAiCreditsStripe } from "@/lib/billing/ai-credits/stripe";
import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";
import { getPrisma } from "@/lib/db/prisma";

import { billablePlan, creditsForInvoice, decidePlanCheckout, GROWTH_BILLING_DOMAIN, normalizeStripeStatus } from "./policy";

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

/** Plan checkout stays off until the owner confirms prices (GROWTH_BILLING_ENABLED=true). */
export function growthBillingEnabled(): boolean {
  return process.env.GROWTH_BILLING_ENABLED === "true" && Boolean(getStripeSecretKey());
}

export function growthWebhookSecret(): string {
  return process.env.STRIPE_GROWTH_WEBHOOK_SECRET?.trim() ?? "";
}

export async function startPlanCheckout(input: { clientId: string; planKey: string; origin: string }): Promise<string> {
  const plan = billablePlan(input.planKey);
  if (!plan) throw new Error("unknown_plan");
  const prisma = requirePrisma();
  const existing = await prisma.growthSubscription.findFirst({
    where: { clientId: input.clientId, stripeCustomerId: { not: null } },
    select: { stripeCustomerId: true },
  });
  const metadata = { billingDomain: GROWTH_BILLING_DOMAIN, clientId: input.clientId, planKey: plan.key };
  const session = await getAiCreditsStripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: input.clientId,
    ...(existing?.stripeCustomerId ? { customer: existing.stripeCustomerId } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: Math.round(plan.monthlyCad * 100),
          recurring: { interval: "month" },
          product_data: { name: `TAKATAK ${plan.name}` },
        },
      },
    ],
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: true,
    success_url: `${input.origin}/dashboard/growth/pricing?billing=success`,
    cancel_url: `${input.origin}/dashboard/growth/pricing?billing=canceled`,
  });
  if (!session.url) throw new Error("stripe_no_url");
  return session.url;
}

export async function startBillingPortal(clientId: string, origin: string): Promise<string | null> {
  const row = await requirePrisma().growthSubscription.findFirst({
    where: { clientId, stripeCustomerId: { not: null } },
    select: { stripeCustomerId: true },
  });
  if (!row?.stripeCustomerId) return null;
  const portal = await getAiCreditsStripe().billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${origin}/dashboard/growth/pricing`,
  });
  return portal.url;
}

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const itemEnd = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)?.current_period_end;
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const seconds = itemEnd ?? legacy;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

export type GrowthEventOutcome = { handled: boolean; duplicate?: boolean; reason?: string; creditsGranted?: number };

/** Applies one verified Stripe event. Each event id is processed at most once. */
export async function applyGrowthStripeEvent(event: Pick<Stripe.Event, "id" | "type" | "data">): Promise<GrowthEventOutcome> {
  const prisma = requirePrisma();
  const relevant = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid"];
  if (!relevant.includes(event.type)) return { handled: false, reason: "ignored_event" };
  try {
    await prisma.growthBillingEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { handled: false, duplicate: true };
    throw error;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const decision = decidePlanCheckout({
        id: session.id,
        mode: session.mode,
        status: session.status,
        client_reference_id: session.client_reference_id,
        customer: idOf(session.customer),
        subscription: idOf(session.subscription),
        metadata: session.metadata,
      });
      if (!decision.record) return { handled: false, reason: decision.reason };
      await prisma.growthSubscription.upsert({
        where: { clientId_planKey: { clientId: decision.clientId, planKey: decision.planKey } },
        create: { clientId: decision.clientId, planKey: decision.planKey, status: "active", stripeCustomerId: decision.customerId, stripeSubscriptionId: decision.subscriptionId },
        update: { status: "active", stripeCustomerId: decision.customerId, stripeSubscriptionId: decision.subscriptionId, cancelAtPeriodEnd: false },
      });
      return { handled: true };
    }

    if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      const meta = sub.metadata ?? {};
      if (meta.billingDomain !== GROWTH_BILLING_DOMAIN) return { handled: false, reason: "not_growth_plan" };
      const status = event.type === "customer.subscription.deleted" ? "canceled" : normalizeStripeStatus(sub.status);
      const data = { status, currentPeriodEnd: periodEnd(sub), cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end), stripeCustomerId: idOf(sub.customer) };
      const updated = await prisma.growthSubscription.updateMany({ where: { stripeSubscriptionId: sub.id }, data });
      if (updated.count === 0) {
        const plan = billablePlan(meta.planKey ?? "");
        const clientId = meta.clientId ?? "";
        if (!plan || !/^[0-9a-f-]{36}$/i.test(clientId)) return { handled: false, reason: "unknown_subscription" };
        const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
        if (!client) return { handled: false, reason: "unknown_client" };
        // Never let an event for an older/other subscription replace the plan's
        // current one: only a live subscription may take over a canceled slot.
        const current = await prisma.growthSubscription.findUnique({
          where: { clientId_planKey: { clientId, planKey: plan.key } },
          select: { stripeSubscriptionId: true, status: true },
        });
        const live = status === "active" || status === "trialing" || status === "past_due";
        if (current?.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id && !(current.status === "canceled" && live)) {
          return { handled: false, reason: "superseded_subscription" };
        }
        await prisma.growthSubscription.upsert({
          where: { clientId_planKey: { clientId, planKey: plan.key } },
          create: { clientId, planKey: plan.key, stripeSubscriptionId: sub.id, ...data },
          update: { stripeSubscriptionId: sub.id, ...data },
        });
      }
      return { handled: true };
    }

    // invoice.paid → monthly included credits.
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
    if (!subscriptionId) return { handled: false, reason: "not_subscription_invoice" };
    let row = await prisma.growthSubscription.findUnique({ where: { stripeSubscriptionId: subscriptionId }, select: { clientId: true, planKey: true } });
    if (!row) {
      // Stripe does not order events: invoice.paid can arrive before the
      // subscription is recorded. The invoice carries a snapshot of the
      // subscription metadata we set at checkout, so use it when valid.
      const meta = invoice.parent?.subscription_details?.metadata ?? {};
      if (meta.billingDomain !== GROWTH_BILLING_DOMAIN) return { handled: false, reason: "not_growth_plan" };
      const plan = billablePlan(meta.planKey ?? "");
      const clientId = meta.clientId ?? "";
      const client = plan && /^[0-9a-f-]{36}$/i.test(clientId) ? await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }) : null;
      // A Growth invoice we cannot attribute yet: fail so Stripe retries later.
      if (!plan || !client) throw new Error("growth_invoice_unattributed");
      row = { clientId: client.id, planKey: plan.key };
    }
    const credits = creditsForInvoice(row.planKey, invoice.billing_reason);
    if (credits <= 0) return { handled: true, creditsGranted: 0 };
    const grant = await grantCredits({
      clientId: row.clientId,
      credits,
      reason: "grant",
      idempotencyKey: `invoice:${invoice.id}`,
      note: `Included with ${billablePlan(row.planKey)?.name ?? row.planKey}`,
    });
    if (!grant.ok) throw new Error(`credit_grant_${grant.code}`);
    return { handled: true, creditsGranted: grant.replayed ? 0 : credits };
  } catch (error) {
    // Let Stripe retry: forget the event id so the retry is processed.
    await prisma.growthBillingEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    throw error;
  }
}
