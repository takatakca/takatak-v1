import {
  SOCIAL_FREE_PLAN_CODE,
  SOCIAL_FREE_PLAN_NAME,
  SOCIAL_PLAN_CATALOG,
  isPaidCheckoutPlanCode,
  isSocialPlanCode,
} from "./plan-catalog";
import type { SocialSubscriptionStatusName } from "./subscription-lifecycle";
import type { SocialAddonCode, SocialPlanCode } from "./types";

/**
 * Fail on day 0, retry days 1 / 3 / 5 / 7, then Free.
 * Stripe `attempt_count` is 1 on the first failure.
 */
export const SOCIAL_STRIPE_FAILED_PAYMENT_ATTEMPTS = 5;

export const SOCIAL_STRIPE_PROVIDER = "stripe";

export type StripeMappedPrice = {
  cycle: "monthly" | "annual";
  planCode?: SocialPlanCode;
  addonCode?: SocialAddonCode;
};

export type StripePricePlanLookup = Record<string, StripeMappedPrice>;

export type SocialStripeSubscriptionLike = {
  id: string;
  status: string;
  customer?: string | { id?: string } | null;
  cancel_at_period_end?: boolean;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      id?: string;
      quantity?: number | null;
      price?: { id?: string } | string | null;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
  metadata?: Record<string, string | undefined> | null;
};

export type SocialSubscriptionPatch = {
  status: SocialSubscriptionStatusName;
  planCode: string;
  planName: string;
  provider: typeof SOCIAL_STRIPE_PROVIDER;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  xAccountAllowance: number;
  advancedAnalytics: boolean;
};

export type StripeSubscriptionApplyDecision =
  | { action: "skip"; reason: string }
  | {
      action: "apply";
      patch: SocialSubscriptionPatch;
      forceCancelStripe: boolean;
    };

export function unixSecondsToDate(
  value: number | null | undefined,
): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value * 1000);
}

export function stripeCustomerId(
  customer: SocialStripeSubscriptionLike["customer"],
): string | null {
  if (typeof customer === "string" && customer.trim()) {
    return customer.trim();
  }

  if (customer && typeof customer === "object" && typeof customer.id === "string") {
    return customer.id.trim() || null;
  }

  return null;
}

export function stripeItemPriceId(
  price: { id?: string } | string | null | undefined,
): string | null {
  if (typeof price === "string" && price.trim()) {
    return price.trim();
  }

  if (price && typeof price === "object" && typeof price.id === "string") {
    return price.id.trim() || null;
  }

  return null;
}

export function stripeSubscriptionPriceId(
  subscription: SocialStripeSubscriptionLike,
): string | null {
  return stripeItemPriceId(subscription.items?.data?.[0]?.price);
}

export function stripePlanPriceId(
  subscription: SocialStripeSubscriptionLike,
  priceMap: StripePricePlanLookup,
): string | null {
  for (const item of subscription.items?.data ?? []) {
    const priceId = stripeItemPriceId(item.price);
    if (priceId && priceMap[priceId]?.planCode) {
      return priceId;
    }
  }

  return stripeSubscriptionPriceId(subscription);
}

export function resolveAddonsFromStripe(
  subscription: SocialStripeSubscriptionLike,
  priceMap: StripePricePlanLookup,
): { xAccountAllowance: number; advancedAnalytics: boolean } {
  let xAccountAllowance = 0;
  let advancedAnalytics = false;

  for (const item of subscription.items?.data ?? []) {
    const priceId = stripeItemPriceId(item.price);
    if (!priceId) {
      continue;
    }

    const mapped = priceMap[priceId];
    const quantity = Math.max(0, Math.floor(item.quantity ?? 1));
    if (mapped?.addonCode === "x_account") {
      xAccountAllowance += quantity;
    }
    if (mapped?.addonCode === "advanced_analytics" && quantity > 0) {
      advancedAnalytics = true;
    }
  }

  return { xAccountAllowance, advancedAnalytics };
}

export function stripeSubscriptionPeriod(subscription: SocialStripeSubscriptionLike): {
  start: Date | null;
  end: Date | null;
} {
  const item = subscription.items?.data?.[0];
  return {
    start: unixSecondsToDate(
      subscription.current_period_start ?? item?.current_period_start,
    ),
    end: unixSecondsToDate(
      subscription.current_period_end ?? item?.current_period_end,
    ),
  };
}

/**
 * Stripe `incomplete` must not lock a Free workspace that just clicked Upgrade.
 * Wait for `active` / `trialing` from a later event.
 */
export function mapStripeSubscriptionStatus(
  status: string | null | undefined,
): SocialSubscriptionStatusName | "skip" {
  switch (status) {
    case "trialing":
      return "trial";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
    case "incomplete_expired":
      return "free";
    case "paused":
      return "paused";
    case "incomplete":
      return "skip";
    default:
      return "skip";
  }
}

export function resolvePlanCodeFromStripe(input: {
  metadataPlanCode?: string | null;
  priceId?: string | null;
  priceMap: StripePricePlanLookup;
}): SocialPlanCode | null {
  if (isSocialPlanCode(input.metadataPlanCode)) {
    return input.metadataPlanCode;
  }

  if (input.priceId && input.priceMap[input.priceId]?.planCode) {
    const planCode = input.priceMap[input.priceId].planCode;
    if (isSocialPlanCode(planCode)) {
      return planCode;
    }
  }

  return null;
}

export function socialFreeSubscriptionPatch(input: {
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
}): SocialSubscriptionPatch {
  return {
    status: "free",
    planCode: SOCIAL_FREE_PLAN_CODE,
    planName: SOCIAL_FREE_PLAN_NAME,
    provider: SOCIAL_STRIPE_PROVIDER,
    externalCustomerId: input.externalCustomerId ?? null,
    externalSubscriptionId: input.externalSubscriptionId ?? null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    xAccountAllowance: 0,
    advancedAnalytics: false,
  };
}

export function shouldForceFreeAfterFailedInvoice(
  attemptCount: number | null | undefined,
): boolean {
  return (
    typeof attemptCount === "number" &&
    attemptCount >= SOCIAL_STRIPE_FAILED_PAYMENT_ATTEMPTS
  );
}

export function interpretStripeSubscriptionEvent(
  subscription: SocialStripeSubscriptionLike,
  priceMap: StripePricePlanLookup,
): StripeSubscriptionApplyDecision {
  const mapped = mapStripeSubscriptionStatus(subscription.status);

  if (mapped === "skip") {
    return {
      action: "skip",
      reason: `Stripe subscription status "${subscription.status}" does not change TAKATAK billing yet.`,
    };
  }

  const customerId = stripeCustomerId(subscription.customer);

  if (mapped === "free") {
    return {
      action: "apply",
      forceCancelStripe: subscription.status === "unpaid",
      patch: socialFreeSubscriptionPatch({
        externalCustomerId: customerId,
        externalSubscriptionId:
          subscription.status === "incomplete_expired" ? null : subscription.id,
      }),
    };
  }

  const planCode = resolvePlanCodeFromStripe({
    metadataPlanCode: subscription.metadata?.planCode,
    priceId: stripePlanPriceId(subscription, priceMap),
    priceMap,
  });

  if (!planCode || planCode === SOCIAL_FREE_PLAN_CODE) {
    return {
      action: "skip",
      reason: "The Stripe subscription does not map to a TAKATAK Social plan.",
    };
  }

  const period = stripeSubscriptionPeriod(subscription);
  const addOns = resolveAddonsFromStripe(subscription, priceMap);

  return {
    action: "apply",
    forceCancelStripe: false,
    patch: {
      status: mapped,
      planCode,
      planName: SOCIAL_PLAN_CATALOG[planCode].planName,
      provider: SOCIAL_STRIPE_PROVIDER,
      externalCustomerId: customerId,
      externalSubscriptionId: subscription.id,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      xAccountAllowance: addOns.xAccountAllowance,
      advancedAnalytics: addOns.advancedAnalytics,
    },
  };
}

export function interpretFailedStripeInvoice(input: {
  attemptCount: number | null | undefined;
  subscription: SocialStripeSubscriptionLike | null;
  priceMap: StripePricePlanLookup;
}): StripeSubscriptionApplyDecision {
  if (!input.subscription) {
    return {
      action: "skip",
      reason: "The failed invoice is not tied to a subscription.",
    };
  }

  if (shouldForceFreeAfterFailedInvoice(input.attemptCount)) {
    return {
      action: "apply",
      forceCancelStripe: true,
      patch: socialFreeSubscriptionPatch({
        externalCustomerId: stripeCustomerId(input.subscription.customer),
        externalSubscriptionId: input.subscription.id,
      }),
    };
  }

  const decision = interpretStripeSubscriptionEvent(
    input.subscription,
    input.priceMap,
  );

  if (decision.action === "skip") {
    const planCode = resolvePlanCodeFromStripe({
      metadataPlanCode: input.subscription.metadata?.planCode,
      priceId: stripePlanPriceId(input.subscription, input.priceMap),
      priceMap: input.priceMap,
    });

    if (!planCode || !isPaidCheckoutPlanCode(planCode)) {
      return decision;
    }

    const period = stripeSubscriptionPeriod(input.subscription);
    const addOns = resolveAddonsFromStripe(input.subscription, input.priceMap);
    return {
      action: "apply",
      forceCancelStripe: false,
      patch: {
        status: "past_due",
        planCode,
        planName: SOCIAL_PLAN_CATALOG[planCode].planName,
        provider: SOCIAL_STRIPE_PROVIDER,
        externalCustomerId: stripeCustomerId(input.subscription.customer),
        externalSubscriptionId: input.subscription.id,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: Boolean(input.subscription.cancel_at_period_end),
        xAccountAllowance: addOns.xAccountAllowance,
        advancedAnalytics: addOns.advancedAnalytics,
      },
    };
  }

  return {
    ...decision,
    patch: {
      ...decision.patch,
      status: "past_due",
    },
  };
}

export function interpretDeletedStripeSubscription(
  subscription: SocialStripeSubscriptionLike,
): StripeSubscriptionApplyDecision {
  return {
    action: "apply",
    forceCancelStripe: false,
    patch: socialFreeSubscriptionPatch({
      externalCustomerId: stripeCustomerId(subscription.customer),
      externalSubscriptionId: null,
    }),
  };
}
