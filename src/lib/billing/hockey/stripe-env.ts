import "server-only";

import {
  HOCKEY_SELF_SERVE_PLAN_CODES,
  type HockeySelfServePlanCode,
} from "./plan-catalog";
import {
  hockeyStripePriceEnvKey,
  resolveHockeyCheckoutLive,
} from "./membership-policy";
import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";

export function getHockeyStripeWebhookSecret(): string {
  return process.env.STRIPE_HOCKEY_WEBHOOK_SECRET?.trim() ?? "";
}

export function getHockeyMembershipSelfServeEnabled(): boolean {
  return process.env.HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED === "true";
}

export function getHockeyStripePriceId(
  planCode: HockeySelfServePlanCode,
): string {
  return process.env[hockeyStripePriceEnvKey(planCode)]?.trim() ?? "";
}

export function readHockeyStripePriceMap(): Record<
  string,
  { planCode: HockeySelfServePlanCode }
> {
  const result: Record<string, { planCode: HockeySelfServePlanCode }> = {};

  for (const planCode of HOCKEY_SELF_SERVE_PLAN_CODES) {
    const priceId = getHockeyStripePriceId(planCode);
    if (priceId) result[priceId] = { planCode };
  }

  return result;
}

export function isHockeyMembershipCheckoutLive(): boolean {
  const memberPrice = getHockeyStripePriceId("hockey_member_weekly_10");

  return resolveHockeyCheckoutLive({
    enabled: getHockeyMembershipSelfServeEnabled(),
    secretKey: getStripeSecretKey(),
    webhookSecret: getHockeyStripeWebhookSecret(),
    priceId: memberPrice,
  });
}
