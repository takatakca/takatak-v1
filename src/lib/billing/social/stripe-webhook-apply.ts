import "server-only";

import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { applySocialBrandAllowance } from "./brand-allowance";
import { ensureDefaultSocialSubscription } from "./ensure-free-subscription";
import { getStripe } from "./stripe-client";
import { readSocialStripePriceMap } from "./stripe-env";
import {
  interpretDeletedStripeSubscription,
  interpretFailedStripeInvoice,
  interpretStripeSubscriptionEvent,
  stripeCustomerId,
  type SocialStripeSubscriptionLike,
  type SocialSubscriptionPatch,
  type StripeSubscriptionApplyDecision,
} from "./stripe-webhook-policy";
import { getPrisma } from "@/lib/db/prisma";
import { isServiceError } from "@/lib/services/service-error";
import { isUuid } from "@/lib/validation/common";

export type StripeWebhookApplyResult = {
  processed: boolean;
  duplicate: boolean;
  skipped: boolean;
  clientId: string | null;
  reason: string;
};

function asSubscriptionLike(
  value: Stripe.Subscription,
): SocialStripeSubscriptionLike {
  return value;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent?.subscription_details?.subscription;
  if (typeof parent === "string" && parent.trim()) {
    return parent.trim();
  }

  if (parent && typeof parent === "object" && "id" in parent) {
    const id = (parent as { id?: string }).id;
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }
  }

  return null;
}

function expandId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === "object" && typeof value.id === "string") {
    return value.id.trim() || null;
  }

  return null;
}

async function alreadyProcessed(stripeEventId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) {
    return false;
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId },
    select: { id: true },
  });

  return Boolean(existing);
}

async function recordEvent(input: {
  stripeEventId: string;
  type: string;
  clientId: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        stripeEventId: input.stripeEventId,
        type: input.type,
        clientId: input.clientId,
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

async function findClientId(input: {
  metadataClientId?: string | null;
  clientReferenceId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const hinted = [input.metadataClientId, input.clientReferenceId]
    .map((value) => value?.trim())
    .find((value) => value && isUuid(value));

  if (hinted) {
    const client = await prisma.client.findUnique({
      where: { id: hinted },
      select: { id: true },
    });
    if (client) {
      return client.id;
    }
  }

  if (input.subscriptionId) {
    const bySubscription = await prisma.clientSubscription.findFirst({
      where: { externalSubscriptionId: input.subscriptionId },
      select: { clientId: true },
    });
    if (bySubscription) {
      return bySubscription.clientId;
    }
  }

  if (input.customerId) {
    const byCustomer = await prisma.clientSubscription.findFirst({
      where: { externalCustomerId: input.customerId },
      select: { clientId: true },
    });
    if (byCustomer) {
      return byCustomer.clientId;
    }

    try {
      const customer = await getStripe().customers.retrieve(input.customerId);
      if (!("deleted" in customer && customer.deleted)) {
        const metaId = customer.metadata?.clientId?.trim();
        if (metaId && isUuid(metaId)) {
          const client = await prisma.client.findUnique({
            where: { id: metaId },
            select: { id: true },
          });
          if (client) {
            return client.id;
          }
        }
      }
    } catch {
      // Customer lookup is best-effort.
    }
  }

  return null;
}

async function applyPatch(
  clientId: string,
  patch: SocialSubscriptionPatch,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  await ensureDefaultSocialSubscription(prisma, clientId);

  await prisma.clientSubscription.update({
    where: { clientId },
    data: {
      status: patch.status,
      planCode: patch.planCode,
      planName: patch.planName,
      provider: patch.provider,
      externalCustomerId: patch.externalCustomerId,
      externalSubscriptionId: patch.externalSubscriptionId,
      currentPeriodStart: patch.currentPeriodStart,
      currentPeriodEnd: patch.currentPeriodEnd,
      cancelAtPeriodEnd: patch.cancelAtPeriodEnd,
      xAccountAllowance: patch.xAccountAllowance,
      advancedAnalytics: patch.advancedAnalytics,
    },
  });

  try {
    await applySocialBrandAllowance({
      clientId,
      keepBrandIds: null,
    });
  } catch (error) {
    if (isServiceError(error) && error.code === "invalid_input") {
      return;
    }

    console.error(
      "[stripe-webhook] Brand allowance could not auto-apply after a plan change.",
      error instanceof Error ? error.message : error,
    );
  }
}

async function maybeCancelStripeSubscription(subscriptionId: string): Promise<void> {
  try {
    await getStripe().subscriptions.cancel(subscriptionId);
  } catch {
    // Already canceled or missing. Local Free fallback still stands.
  }
}

async function applyDecision(
  clientId: string,
  decision: StripeSubscriptionApplyDecision,
): Promise<string> {
  if (decision.action === "skip") {
    return decision.reason;
  }

  if (decision.patch.status === "past_due") {
    const prisma = getPrisma();
    const current = await prisma?.clientSubscription.findUnique({
      where: { clientId },
      select: { status: true },
    });
    if (current?.status === "free") {
      return "Ignored a past-due event because this workspace already fell back to Free.";
    }
  }

  if (decision.forceCancelStripe && decision.patch.externalSubscriptionId) {
    await maybeCancelStripeSubscription(decision.patch.externalSubscriptionId);
    decision.patch.externalSubscriptionId = null;
  }

  await applyPatch(clientId, decision.patch);
  return `Applied ${decision.patch.status} / ${decision.patch.planCode}.`;
}

async function loadSubscription(
  value: string | Stripe.Subscription | null | undefined,
): Promise<Stripe.Subscription | null> {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return getStripe().subscriptions.retrieve(value);
  }

  return value;
}

export async function applySocialStripeWebhookEvent(
  event: Stripe.Event,
): Promise<StripeWebhookApplyResult> {
  if (await alreadyProcessed(event.id)) {
    return {
      processed: true,
      duplicate: true,
      skipped: false,
      clientId: null,
      reason: "This Stripe event was already processed.",
    };
  }

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is unavailable.");
  }

  const priceMap = readSocialStripePriceMap();
  let clientId: string | null = null;
  let reason = "Event ignored.";
  let skipped = true;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          reason = "Checkout session is not a Social subscription.";
          break;
        }

        if (session.payment_status !== "paid") {
          reason = "Checkout is not paid yet. The workspace stays on its current plan.";
          break;
        }

        const subscription = await loadSubscription(session.subscription);
        clientId = await findClientId({
          metadataClientId: session.metadata?.clientId,
          clientReferenceId: session.client_reference_id,
          customerId: expandId(session.customer),
          subscriptionId: subscription?.id ?? expandId(session.subscription),
        });

        if (!clientId || !subscription) {
          reason = "Checkout completed, but the workspace or subscription could not be matched.";
          break;
        }

        skipped = false;
        reason = await applyDecision(
          clientId,
          interpretStripeSubscriptionEvent(asSubscriptionLike(subscription), priceMap),
        );
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        clientId = await findClientId({
          metadataClientId: subscription.metadata?.clientId,
          customerId: stripeCustomerId(subscription.customer),
          subscriptionId: subscription.id,
        });

        if (!clientId) {
          reason = "Subscription event did not match a workspace.";
          break;
        }

        skipped = false;
        reason = await applyDecision(
          clientId,
          interpretStripeSubscriptionEvent(asSubscriptionLike(subscription), priceMap),
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        clientId = await findClientId({
          metadataClientId: subscription.metadata?.clientId,
          customerId: stripeCustomerId(subscription.customer),
          subscriptionId: subscription.id,
        });

        if (!clientId) {
          reason = "Deleted subscription did not match a workspace.";
          break;
        }

        skipped = false;
        reason = await applyDecision(
          clientId,
          interpretDeletedStripeSubscription(asSubscriptionLike(subscription)),
        );
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await loadSubscription(invoiceSubscriptionId(invoice));
        clientId = await findClientId({
          customerId: expandId(invoice.customer),
          subscriptionId: subscription?.id ?? invoiceSubscriptionId(invoice),
        });

        if (!clientId || !subscription) {
          reason = "Paid invoice did not match a Social subscription.";
          break;
        }

        skipped = false;
        reason = await applyDecision(
          clientId,
          interpretStripeSubscriptionEvent(asSubscriptionLike(subscription), priceMap),
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = await loadSubscription(invoiceSubscriptionId(invoice));
        clientId = await findClientId({
          customerId: expandId(invoice.customer),
          subscriptionId: subscription?.id ?? invoiceSubscriptionId(invoice),
        });

        if (!clientId) {
          reason = "Failed invoice did not match a workspace.";
          break;
        }

        skipped = false;
        reason = await applyDecision(
          clientId,
          interpretFailedStripeInvoice({
            attemptCount: invoice.attempt_count,
            subscription: subscription
              ? asSubscriptionLike(subscription)
              : null,
            priceMap,
          }),
        );
        break;
      }

      default:
        reason = `Unhandled Stripe event type "${event.type}".`;
        break;
    }

    if (reason.startsWith("Applied")) {
      skipped = false;
    }
  } catch (error) {
    throw error;
  }

  await recordEvent({
    stripeEventId: event.id,
    type: event.type,
    clientId,
  });

  return {
    processed: true,
    duplicate: false,
    skipped,
    clientId,
    reason,
  };
}
