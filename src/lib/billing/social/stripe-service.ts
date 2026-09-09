import "server-only";

import type Stripe from "stripe";

import { ensureDefaultSocialSubscription } from "./ensure-free-subscription";
import type { PaidCheckoutPlanCode } from "./plan-catalog";
import { resolveEffectiveSocialEntitlements } from "./subscription-lifecycle";
import { getStripe } from "./stripe-client";
import {
  isSocialBillingCycle,
  resolveSocialStripePlanChange,
  type SocialBillingCycle,
} from "./stripe-checkout-policy";
import {
  resolveSocialStripeAddonChange,
  type SocialAddonAction,
} from "./stripe-addon-policy";
import type { SocialAddonCode } from "./types";
import { SOCIAL_STRIPE_PROVIDER, stripeItemPriceId } from "./stripe-webhook-policy";
import {
  getSocialStripeAddonPriceId,
  getSocialStripePriceId,
  isSocialStripeAddonCheckoutLive,
  isSocialStripeCheckoutLive,
  readSocialStripePriceMap,
} from "./stripe-env";
import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

const BILLING_RETURN_PATH = "/dashboard/social/settings?tab=billing";

function billingUrls(origin: string) {
  return {
    success: `${origin}${BILLING_RETURN_PATH}&checkout=success`,
    cancel: `${origin}${BILLING_RETURN_PATH}&checkout=canceled`,
    portal: `${origin}${BILLING_RETURN_PATH}`,
  };
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

function mappedPriceId(
  price: Stripe.SubscriptionItem["price"] | undefined,
): string | null {
  if (!price) {
    return null;
  }
  return stripeItemPriceId(price) ?? expandId(price);
}

function planSubscriptionItem(
  subscription: Stripe.Subscription,
): Stripe.SubscriptionItem | null {
  const priceMap = readSocialStripePriceMap();
  const planItem = subscription.items.data.find((item) => {
    const priceId = mappedPriceId(item.price);
    return Boolean(priceId && priceMap[priceId]?.planCode);
  });

  return planItem ?? subscription.items.data[0] ?? null;
}

function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  return mappedPriceId(planSubscriptionItem(subscription)?.price);
}

function currentPhaseItems(
  subscription: Stripe.Subscription,
  planPriceOverride?: string,
): Array<{ price: string; quantity: number }> {
  const priceMap = readSocialStripePriceMap();
  const items: Array<{ price: string; quantity: number }> = [];

  for (const item of subscription.items.data) {
    const priceId = mappedPriceId(item.price);
    if (!priceId) {
      continue;
    }

    const isPlan = Boolean(priceMap[priceId]?.planCode);
    items.push({
      price: isPlan && planPriceOverride ? planPriceOverride : priceId,
      quantity: item.quantity ?? 1,
    });
  }

  if (planPriceOverride && !items.some((item) => item.price === planPriceOverride)) {
    const planItem = planSubscriptionItem(subscription);
    if (planItem) {
      items.push({
        price: planPriceOverride,
        quantity: planItem.quantity ?? 1,
      });
    }
  }

  return items;
}

async function loadWorkspace(clientId: string) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError("unavailable", "Billing is temporarily unavailable.");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      invoiceEmails: true,
      subscription: {
        select: {
          status: true,
          planCode: true,
          planName: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
          externalCustomerId: true,
          externalSubscriptionId: true,
          xAccountAllowance: true,
          advancedAnalytics: true,
        },
      },
    },
  });

  if (!client) {
    throw new ServiceError("not_found", "The selected workspace could not be found.");
  }

  await ensureDefaultSocialSubscription(prisma, clientId);

  const subscription =
    client.subscription ??
    (await prisma.clientSubscription.findUnique({
      where: { clientId },
      select: {
        status: true,
        planCode: true,
        planName: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        externalCustomerId: true,
        externalSubscriptionId: true,
        xAccountAllowance: true,
        advancedAnalytics: true,
      },
    }));

  return { prisma, client, subscription };
}

async function persistStripeCustomerId(
  clientId: string,
  customerId: string,
): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    return;
  }

  await prisma.clientSubscription.update({
    where: { clientId },
    data: {
      provider: SOCIAL_STRIPE_PROVIDER,
      externalCustomerId: customerId,
    },
  });
}

export async function ensureSocialStripeCustomer(clientId: string): Promise<string> {
  const { client, subscription } = await loadWorkspace(clientId);
  const stripe = getStripe();

  if (subscription?.externalCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(subscription.externalCustomerId);
      if (!("deleted" in existing && existing.deleted)) {
        return existing.id;
      }
    } catch {
      // Create a replacement customer below.
    }
  }

  try {
    const search = await stripe.customers.search({
      query: `metadata["clientId"]:"${clientId}"`,
      limit: 1,
    });
    const found = search.data[0];
    if (found) {
      await persistStripeCustomerId(clientId, found.id);
      return found.id;
    }
  } catch {
    // Search is optional. Fall through to create.
  }

  const email =
    client.email?.trim() ||
    client.invoiceEmails.find((value) => value.trim()) ||
    undefined;

  const created = await stripe.customers.create({
    email,
    name: client.companyName?.trim() || client.name,
    metadata: {
      clientId,
      product: "social",
    },
  });

  await persistStripeCustomerId(clientId, created.id);
  return created.id;
}

async function requirePriceId(
  planCode: PaidCheckoutPlanCode,
  cycle: SocialBillingCycle,
): Promise<string> {
  const priceId = getSocialStripePriceId(planCode, cycle);

  if (!priceId) {
    throw new ServiceError(
      "unavailable",
      "This plan is not available for checkout yet. Add its Stripe Price ID first.",
    );
  }

  return priceId;
}

async function releaseExistingSchedule(subscription: Stripe.Subscription): Promise<void> {
  const scheduleId = expandId(subscription.schedule);

  if (!scheduleId) {
    return;
  }

  const stripe = getStripe();
  await stripe.subscriptionSchedules.release(scheduleId);
}

async function scheduleDowngrade(input: {
  subscription: Stripe.Subscription;
  priceId: string;
  clientId: string;
  planCode: PaidCheckoutPlanCode;
  billingCycle: SocialBillingCycle;
}): Promise<void> {
  const stripe = getStripe();
  const currentItem = planSubscriptionItem(input.subscription);
  const currentPriceId = subscriptionPriceId(input.subscription);
  const periodEnd = currentItem?.current_period_end;
  const currentItems = currentPhaseItems(input.subscription);
  const nextItems = currentPhaseItems(input.subscription, input.priceId);

  if (!currentItem || !currentPriceId || !periodEnd || currentItems.length === 0) {
    throw new ServiceError(
      "unavailable",
      "Stripe could not schedule this downgrade. Open the customer portal or try again later.",
    );
  }

  await releaseExistingSchedule(input.subscription);

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: input.subscription.id,
  });

  const currentPhase = schedule.phases[0];

  if (!currentPhase) {
    throw new ServiceError(
      "unavailable",
      "Stripe could not schedule this downgrade. Open the customer portal or try again later.",
    );
  }

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: currentItems,
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date ?? periodEnd,
      },
      {
        items: nextItems,
        metadata: {
          clientId: input.clientId,
          planCode: input.planCode,
          billingCycle: input.billingCycle,
        },
      },
    ],
  });
}

export async function startSocialStripeCheckout(input: {
  clientId: string;
  planCode: PaidCheckoutPlanCode;
  billingCycle: SocialBillingCycle;
  requestOrigin?: string | null;
}): Promise<{ url: string } | { updated: true; message: string }> {
  if (!isSocialStripeCheckoutLive()) {
    throw new ServiceError(
      "unavailable",
      "Stripe checkout is not live yet. Add the secret key, webhook secret, and at least one Price ID.",
    );
  }

  const { subscription } = await loadWorkspace(input.clientId);
  const { lifecycle, entitlements } = resolveEffectiveSocialEntitlements({
    status: subscription?.status,
    planCode: subscription?.planCode,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    addOns: {
      xAccountAllowance: subscription?.xAccountAllowance ?? 0,
      advancedAnalytics: subscription?.advancedAnalytics ?? false,
    },
  });

  const change = resolveSocialStripePlanChange({
    currentPlanCode: entitlements.planCode,
    targetPlanCode: input.planCode,
    hasStripeSubscription: Boolean(subscription?.externalSubscriptionId),
    currentAccess: lifecycle.access,
  });

  if (change === "forbidden") {
    throw new ServiceError(
      "invalid_input",
      "Custom plans are not self-serve. Talk to us instead.",
    );
  }

  const priceId = await requirePriceId(input.planCode, input.billingCycle);
  const customerId = await ensureSocialStripeCustomer(input.clientId);
  const stripe = getStripe();
  const origin = getApplicationOrigin(input.requestOrigin);
  const urls = billingUrls(origin);

  if (
    (change === "upgrade" ||
      change === "downgrade" ||
      change === "interval" ||
      change === "noop") &&
    subscription?.externalSubscriptionId
  ) {
    const current = await stripe.subscriptions.retrieve(
      subscription.externalSubscriptionId,
    );
    const currentPrice = subscriptionPriceId(current);

    if (currentPrice === priceId) {
      throw new ServiceError(
        "conflict",
        "This workspace is already on that plan.",
      );
    }

    const item = planSubscriptionItem(current);

    if (!item) {
      throw new ServiceError(
        "unavailable",
        "Stripe could not update this subscription. Try checkout again later.",
      );
    }

    if (change === "downgrade" || (change === "interval" && input.billingCycle === "monthly")) {
      try {
        await scheduleDowngrade({
          subscription: current,
          priceId,
          clientId: input.clientId,
          planCode: input.planCode,
          billingCycle: input.billingCycle,
        });
      } catch (error) {
        if (error instanceof ServiceError) {
          throw error;
        }

        throw new ServiceError(
          "unavailable",
          "This downgrade could not be scheduled at period end. Open the customer portal or try again later.",
        );
      }

      return {
        updated: true,
        message:
          "The lower plan is scheduled for the end of the current billing period. TAKATAK updates when Stripe confirms it.",
      };
    }

    await releaseExistingSchedule(current);
    await stripe.subscriptions.update(current.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
      cancel_at_period_end: false,
      metadata: {
        clientId: input.clientId,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
      },
    });

    return {
      updated: true,
      message:
        "Stripe is updating this plan. It appears here when the webhook confirms payment. This page does not unlock it.",
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.clientId,
    success_url: urls.success,
    cancel_url: urls.cancel,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    metadata: {
      clientId: input.clientId,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
    },
    subscription_data: {
      metadata: {
        clientId: input.clientId,
        planCode: input.planCode,
        billingCycle: input.billingCycle,
      },
    },
  });

  if (!session.url) {
    throw new ServiceError(
      "unavailable",
      "Stripe Checkout did not return a URL.",
    );
  }

  return { url: session.url };
}

export async function startSocialStripePortal(input: {
  clientId: string;
  requestOrigin?: string | null;
}): Promise<{ url: string }> {
  if (!isSocialStripeCheckoutLive()) {
    throw new ServiceError(
      "unavailable",
      "The Stripe customer portal is not live yet.",
    );
  }

  const { subscription } = await loadWorkspace(input.clientId);

  if (!subscription?.externalCustomerId) {
    throw new ServiceError(
      "invalid_input",
      "This workspace does not have a Stripe customer yet. Upgrade a plan first.",
    );
  }

  const stripe = getStripe();
  const origin = getApplicationOrigin(input.requestOrigin);
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.externalCustomerId,
    return_url: billingUrls(origin).portal,
  });

  if (!session.url) {
    throw new ServiceError(
      "unavailable",
      "Stripe did not return a customer portal URL.",
    );
  }

  return { url: session.url };
}

function subscriptionBillingCycle(
  subscription: Stripe.Subscription,
): SocialBillingCycle {
  const fromMeta = subscription.metadata?.billingCycle;
  if (isSocialBillingCycle(fromMeta)) {
    return fromMeta;
  }

  const priceMap = readSocialStripePriceMap();
  for (const item of subscription.items.data) {
    const priceId = mappedPriceId(item.price);
    const cycle = priceId ? priceMap[priceId]?.cycle : undefined;
    if (cycle) {
      return cycle;
    }
  }

  return "monthly";
}

function addonItem(
  subscription: Stripe.Subscription,
  addonCode: SocialAddonCode,
): Stripe.SubscriptionItem | null {
  const priceMap = readSocialStripePriceMap();
  return (
    subscription.items.data.find((item) => {
      const priceId = mappedPriceId(item.price);
      return Boolean(priceId && priceMap[priceId]?.addonCode === addonCode);
    }) ?? null
  );
}

function requireAddonPriceId(
  addonCode: SocialAddonCode,
  cycle: SocialBillingCycle,
): string {
  const priceId = getSocialStripeAddonPriceId(addonCode, cycle);
  if (!priceId) {
    throw new ServiceError(
      "unavailable",
      "This add-on is not available for checkout yet. Add its Stripe Price ID first.",
    );
  }
  return priceId;
}

function itemsForAddonState(
  subscription: Stripe.Subscription,
  cycle: SocialBillingCycle,
  state: { xAccountAllowance: number; advancedAnalytics: boolean },
): Array<{ price: string; quantity: number }> {
  const priceMap = readSocialStripePriceMap();
  const items: Array<{ price: string; quantity: number }> = [];

  for (const item of subscription.items.data) {
    const priceId = mappedPriceId(item.price);
    if (!priceId || priceMap[priceId]?.addonCode) {
      continue;
    }
    items.push({ price: priceId, quantity: item.quantity ?? 1 });
  }

  if (state.xAccountAllowance > 0) {
    items.push({
      price: requireAddonPriceId("x_account", cycle),
      quantity: state.xAccountAllowance,
    });
  }

  if (state.advancedAnalytics) {
    items.push({
      price: requireAddonPriceId("advanced_analytics", cycle),
      quantity: 1,
    });
  }

  return items;
}

async function scheduleAddonChange(input: {
  subscription: Stripe.Subscription;
  clientId: string;
  cycle: SocialBillingCycle;
  xAccountAllowance: number;
  advancedAnalytics: boolean;
}): Promise<void> {
  const stripe = getStripe();
  const currentItem = planSubscriptionItem(input.subscription);
  const periodEnd = currentItem?.current_period_end;
  const currentItems = currentPhaseItems(input.subscription);
  const nextItems = itemsForAddonState(input.subscription, input.cycle, {
    xAccountAllowance: input.xAccountAllowance,
    advancedAnalytics: input.advancedAnalytics,
  });

  if (!currentItem || !periodEnd || currentItems.length === 0) {
    throw new ServiceError(
      "unavailable",
      "Stripe could not schedule this add-on change. Open the customer portal or try again later.",
    );
  }

  if (expandId(input.subscription.schedule)) {
    throw new ServiceError(
      "conflict",
      "A billing change is already scheduled. Wait for it to finish or use the customer portal.",
    );
  }

  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: input.subscription.id,
  });
  const currentPhase = schedule.phases[0];

  if (!currentPhase) {
    throw new ServiceError(
      "unavailable",
      "Stripe could not schedule this add-on change. Open the customer portal or try again later.",
    );
  }

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: currentItems,
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date ?? periodEnd,
      },
      {
        items: nextItems,
        metadata: {
          clientId: input.clientId,
          xAccountAllowance: String(input.xAccountAllowance),
          advancedAnalytics: input.advancedAnalytics ? "true" : "false",
        },
      },
    ],
  });
}

export async function startSocialStripeAddonChange(input: {
  clientId: string;
  addonCode: SocialAddonCode;
  action: SocialAddonAction;
}): Promise<{ updated: true; message: string }> {
  if (!isSocialStripeCheckoutLive() || !isSocialStripeAddonCheckoutLive()) {
    throw new ServiceError(
      "unavailable",
      "Add-on checkout is not live yet. Add Stripe keys and add-on Price IDs first.",
    );
  }

  const { subscription } = await loadWorkspace(input.clientId);
  const { lifecycle, entitlements } = resolveEffectiveSocialEntitlements({
    status: subscription?.status,
    planCode: subscription?.planCode,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    addOns: {
      xAccountAllowance: subscription?.xAccountAllowance ?? 0,
      advancedAnalytics: subscription?.advancedAnalytics ?? false,
    },
  });

  if (lifecycle.status === "past_due" || lifecycle.status === "grace_period") {
    throw new ServiceError(
      "forbidden",
      "Update the payment method in the customer portal before changing add-ons.",
    );
  }

  const decision = resolveSocialStripeAddonChange({
    access: lifecycle.access,
    entitlements,
    hasStripeSubscription: Boolean(subscription?.externalSubscriptionId),
    addonCode: input.addonCode,
    action: input.action,
  });

  if (decision.kind === "forbidden") {
    throw new ServiceError("forbidden", decision.message);
  }

  if (decision.kind === "conflict") {
    throw new ServiceError("conflict", decision.message);
  }

  const stripe = getStripe();
  const current = await stripe.subscriptions.retrieve(
    subscription!.externalSubscriptionId!,
  );

  if (expandId(current.schedule) && decision.kind === "update_now") {
    throw new ServiceError(
      "conflict",
      "A billing change is already scheduled. Wait for it to finish or use the customer portal.",
    );
  }

  const cycle = subscriptionBillingCycle(current);

  if (decision.kind === "schedule_period_end") {
    await scheduleAddonChange({
      subscription: current,
      clientId: input.clientId,
      cycle,
      xAccountAllowance: decision.xAccountAllowance,
      advancedAnalytics: decision.advancedAnalytics,
    });

    return {
      updated: true,
      message:
        "This add-on will change at the end of the current billing period. TAKATAK updates when Stripe confirms it.",
    };
  }

  const priceId = requireAddonPriceId(decision.addonCode, cycle);
  const existing = addonItem(current, decision.addonCode);
  const quantity =
    decision.addonCode === "x_account" ? decision.xAccountAllowance : 1;

  await stripe.subscriptions.update(current.id, {
    items: existing
      ? [{ id: existing.id, quantity }]
      : [{ price: priceId, quantity }],
    proration_behavior: "always_invoice",
    payment_behavior: "error_if_incomplete",
    metadata: {
      ...current.metadata,
      clientId: input.clientId,
      xAccountAllowance: String(decision.xAccountAllowance),
      advancedAnalytics: decision.advancedAnalytics ? "true" : "false",
    },
  });

  return {
    updated: true,
    message:
      "Stripe is updating this add-on. It appears here when the webhook confirms payment. This page does not unlock it.",
  };
}
