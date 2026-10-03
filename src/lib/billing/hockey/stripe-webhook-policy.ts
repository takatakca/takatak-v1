import {
  HOCKEY_MEMBERSHIP_CATALOG,
  isHockeyMembershipPlanCode,
  isHockeySelfServePlanCode,
  type HockeySelfServePlanCode,
} from "./plan-catalog";

export const HOCKEY_STRIPE_PROVIDER = "stripe" as const;

export type HockeyStripePriceLookup = Record<
  string,
  { planCode: HockeySelfServePlanCode }
>;

export type HockeyStripeSubscriptionLike = {
  id: string;
  status: string;
  customer?: string | { id?: string } | null;
  cancel_at_period_end?: boolean;
  current_period_start?: number | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      price?: { id?: string } | string | null;
      current_period_start?: number | null;
      current_period_end?: number | null;
    }>;
  };
  metadata?: Record<string, string | undefined> | null;
};

export type HockeyMembershipStatusName =
  | "incomplete"
  | "active"
  | "past_due"
  | "grace_period"
  | "canceled"
  | "expired"
  | "paused"
  | "suspended";

export type HockeyMembershipPatch = {
  status: HockeyMembershipStatusName;
  planCode: HockeySelfServePlanCode;
  planName: string;
  provider: typeof HOCKEY_STRIPE_PROVIDER;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type HockeyStripeDecision =
  | { action: "skip"; reason: string }
  | { action: "apply"; patch: HockeyMembershipPatch };

export function hockeyStripeCustomerId(
  customer: HockeyStripeSubscriptionLike["customer"],
): string | null {
  if (typeof customer === "string" && customer.trim()) return customer.trim();
  if (
    customer &&
    typeof customer === "object" &&
    typeof customer.id === "string"
  ) {
    return customer.id.trim() || null;
  }
  return null;
}

export function hockeyStripePriceId(
  price: { id?: string } | string | null | undefined,
): string | null {
  if (typeof price === "string" && price.trim()) return price.trim();
  if (price && typeof price === "object" && typeof price.id === "string") {
    return price.id.trim() || null;
  }
  return null;
}

function unixDate(value: number | null | undefined): Date | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000);
}

function subscriptionPeriod(subscription: HockeyStripeSubscriptionLike) {
  const first = subscription.items?.data?.[0];
  return {
    start: unixDate(
      subscription.current_period_start ?? first?.current_period_start,
    ),
    end: unixDate(
      subscription.current_period_end ?? first?.current_period_end,
    ),
  };
}

export function mapHockeyStripeStatus(
  status: string | null | undefined,
): HockeyMembershipStatusName | "skip" {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "paused";
    case "incomplete":
    case "trialing":
    default:
      return "skip";
  }
}

export function resolveHockeyPlanFromStripe(input: {
  metadataPlanCode?: string | null;
  priceId?: string | null;
  priceMap: HockeyStripePriceLookup;
}): HockeySelfServePlanCode | null {
  if (
    isHockeyMembershipPlanCode(input.metadataPlanCode) &&
    isHockeySelfServePlanCode(input.metadataPlanCode)
  ) {
    return input.metadataPlanCode;
  }

  if (input.priceId) {
    return input.priceMap[input.priceId]?.planCode ?? null;
  }

  return null;
}

export function interpretHockeyStripeSubscription(
  subscription: HockeyStripeSubscriptionLike,
  priceMap: HockeyStripePriceLookup,
): HockeyStripeDecision {
  const status = mapHockeyStripeStatus(subscription.status);
  if (status === "skip") {
    return {
      action: "skip",
      reason: `Stripe status "${subscription.status}" does not grant or change hockey membership access.`,
    };
  }

  const priceId = hockeyStripePriceId(subscription.items?.data?.[0]?.price);
  const planCode = resolveHockeyPlanFromStripe({
    metadataPlanCode: subscription.metadata?.planCode,
    priceId,
    priceMap,
  });

  if (!planCode) {
    return {
      action: "skip",
      reason: "Stripe subscription does not map to a self-serve hockey membership.",
    };
  }

  const period = subscriptionPeriod(subscription);

  return {
    action: "apply",
    patch: {
      status,
      planCode,
      planName: HOCKEY_MEMBERSHIP_CATALOG[planCode].planName,
      provider: HOCKEY_STRIPE_PROVIDER,
      externalCustomerId: hockeyStripeCustomerId(subscription.customer),
      externalSubscriptionId: subscription.id,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    },
  };
}
