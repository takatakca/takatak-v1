import "server-only";

import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { HOCKEY_SOURCE_APPLICATION } from "./membership-policy";
import { getHockeyStripe } from "./stripe-client";
import { readHockeyStripePriceMap } from "./stripe-env";
import {
  hockeyStripeCustomerId,
  interpretHockeyStripeSubscription,
  type HockeyMembershipPatch,
  type HockeyStripeDecision,
  type HockeyStripeSubscriptionLike,
} from "./stripe-webhook-policy";
import { getPrisma } from "@/lib/db/prisma";
import { isUuid } from "@/lib/validation/common";

export type HockeyStripeWebhookApplyResult = {
  processed: boolean;
  duplicate: boolean;
  skipped: boolean;
  identityId: string | null;
  reason: string;
};

function expandId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id.trim() || null;
  }
  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent?.subscription_details?.subscription;
  return expandId(parent as string | { id?: string } | null | undefined);
}

function asSubscriptionLike(
  value: Stripe.Subscription,
): HockeyStripeSubscriptionLike {
  return value;
}

async function loadSubscription(
  value: string | Stripe.Subscription | null | undefined,
): Promise<Stripe.Subscription | null> {
  if (!value) return null;
  if (typeof value === "string") {
    return getHockeyStripe().subscriptions.retrieve(value);
  }
  return value;
}

async function alreadyProcessed(stripeEventId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;

  const row = await prisma.hockeyStripeWebhookEvent.findUnique({
    where: { stripeEventId },
    select: { id: true },
  });

  return Boolean(row);
}

async function recordEvent(input: {
  stripeEventId: string;
  type: string;
  identityId: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  try {
    await prisma.hockeyStripeWebhookEvent.create({
      data: {
        stripeEventId: input.stripeEventId,
        type: input.type,
        identityId: input.identityId,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

async function findIdentityId(input: {
  hintedIdentityId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const hinted = input.hintedIdentityId?.trim() ?? "";
  if (hinted && isUuid(hinted)) {
    const identity = await prisma.masterIdentity.findUnique({
      where: { id: hinted },
      select: { id: true },
    });
    if (identity) return identity.id;
  }

  if (input.subscriptionId) {
    const bySubscription = await prisma.hockeyMembership.findFirst({
      where: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        externalSubscriptionId: input.subscriptionId,
      },
      select: { identityId: true },
    });
    if (bySubscription) return bySubscription.identityId;
  }

  if (input.customerId) {
    const byCustomer = await prisma.hockeyMembership.findFirst({
      where: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        externalCustomerId: input.customerId,
      },
      select: { identityId: true },
    });
    if (byCustomer) return byCustomer.identityId;

    try {
      const customer = await getHockeyStripe().customers.retrieve(
        input.customerId,
      );
      if (!("deleted" in customer && customer.deleted)) {
        const metaId = customer.metadata?.masterIdentityId?.trim();
        if (metaId && isUuid(metaId)) {
          const identity = await prisma.masterIdentity.findUnique({
            where: { id: metaId },
            select: { id: true },
          });
          if (identity) return identity.id;
        }
      }
    } catch {
      // Best-effort fallback only.
    }
  }

  return null;
}

async function applyPatch(
  identityId: string,
  patch: HockeyMembershipPatch,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database is unavailable.");

  await prisma.hockeyMembership.upsert({
    where: {
      identityId_sourceApplication: {
        identityId,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    update: {
      status: patch.status,
      planCode: patch.planCode,
      planName: patch.planName,
      provider: patch.provider,
      externalCustomerId: patch.externalCustomerId,
      externalSubscriptionId: patch.externalSubscriptionId,
      currentPeriodStart: patch.currentPeriodStart,
      currentPeriodEnd: patch.currentPeriodEnd,
      cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
    },
    create: {
      identityId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: patch.status,
      planCode: patch.planCode,
      planName: patch.planName,
      provider: patch.provider,
      externalCustomerId: patch.externalCustomerId,
      externalSubscriptionId: patch.externalSubscriptionId,
      currentPeriodStart: patch.currentPeriodStart,
      currentPeriodEnd: patch.currentPeriodEnd,
      cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
    },
  });
}

async function applyDecision(
  identityId: string,
  decision: HockeyStripeDecision,
  forcePastDue = false,
): Promise<string> {
  if (decision.action === "skip") return decision.reason;

  const patch = forcePastDue
    ? { ...decision.patch, status: "past_due" as const }
    : decision.patch;

  await applyPatch(identityId, patch);
  return `Applied ${patch.status} / ${patch.planCode}.`;
}

async function cancelMembership(
  identityId: string,
  customerId: string | null,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Database is unavailable.");

  await prisma.hockeyMembership.updateMany({
    where: {
      identityId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
    },
    data: {
      status: "canceled",
      externalCustomerId: customerId,
      externalSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });
}

export async function applyHockeyStripeWebhookEvent(
  event: Stripe.Event,
): Promise<HockeyStripeWebhookApplyResult> {
  if (await alreadyProcessed(event.id)) {
    return {
      processed: true,
      duplicate: true,
      skipped: false,
      identityId: null,
      reason: "This hockey Stripe event was already processed.",
    };
  }

  if (!getPrisma()) throw new Error("Database is unavailable.");

  const priceMap = readHockeyStripePriceMap();
  let identityId: string | null = null;
  let reason = "Event ignored.";
  let skipped = true;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (
        session.mode !== "subscription" ||
        session.metadata?.billingDomain !== "hockey_membership"
      ) {
        reason = "Checkout session is not a hockey membership.";
        break;
      }
      if (session.payment_status !== "paid") {
        reason = "Checkout is not paid yet. Hockey access remains blocked.";
        break;
      }

      const subscription = await loadSubscription(session.subscription);
      identityId = await findIdentityId({
        hintedIdentityId:
          session.metadata?.masterIdentityId ?? session.client_reference_id,
        customerId: expandId(session.customer),
        subscriptionId: subscription?.id ?? expandId(session.subscription),
      });

      if (!identityId || !subscription) {
        reason = "Paid hockey checkout could not be matched to an identity.";
        break;
      }

      skipped = false;
      reason = await applyDecision(
        identityId,
        interpretHockeyStripeSubscription(
          asSubscriptionLike(subscription),
          priceMap,
        ),
      );
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const decision = interpretHockeyStripeSubscription(
        asSubscriptionLike(subscription),
        priceMap,
      );

      if (
        subscription.metadata?.billingDomain !== "hockey_membership" &&
        decision.action === "skip"
      ) {
        reason = "Subscription is not mapped to hockey membership.";
        break;
      }

      identityId = await findIdentityId({
        hintedIdentityId: subscription.metadata?.masterIdentityId,
        customerId: hockeyStripeCustomerId(subscription.customer),
        subscriptionId: subscription.id,
      });

      if (!identityId) {
        reason = "Hockey subscription did not match a TAKATAK identity.";
        break;
      }

      skipped = decision.action === "skip";
      reason = await applyDecision(identityId, decision);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      identityId = await findIdentityId({
        hintedIdentityId: subscription.metadata?.masterIdentityId,
        customerId: hockeyStripeCustomerId(subscription.customer),
        subscriptionId: subscription.id,
      });

      if (!identityId) {
        reason = "Deleted hockey subscription did not match an identity.";
        break;
      }

      skipped = false;
      await cancelMembership(
        identityId,
        hockeyStripeCustomerId(subscription.customer),
      );
      reason = "Canceled hockey membership access.";
      break;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = await loadSubscription(
        invoiceSubscriptionId(invoice),
      );

      if (!subscription) {
        reason = "Invoice is not tied to a subscription.";
        break;
      }

      const decision = interpretHockeyStripeSubscription(
        asSubscriptionLike(subscription),
        priceMap,
      );
      identityId = await findIdentityId({
        hintedIdentityId: subscription.metadata?.masterIdentityId,
        customerId: expandId(invoice.customer),
        subscriptionId: subscription.id,
      });

      if (!identityId) {
        reason = "Hockey invoice did not match a TAKATAK identity.";
        break;
      }

      skipped = decision.action === "skip";
      reason = await applyDecision(
        identityId,
        decision,
        event.type === "invoice.payment_failed",
      );
      break;
    }

    default:
      reason = "Stripe event type is not used by hockey membership billing.";
  }

  await recordEvent({
    stripeEventId: event.id,
    type: event.type,
    identityId,
  });

  return {
    processed: true,
    duplicate: false,
    skipped,
    identityId,
    reason,
  };
}
