import "server-only";

import { HOCKEY_MEMBER_PRICE_ENV, resolveHockeyCheckoutLive } from "./membership-policy";
import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";

export function getHockeyStripeWebhookSecret(): string {
  return process.env.STRIPE_HOCKEY_WEBHOOK_SECRET?.trim() ?? "";
}

/** Stripe Price ID of the AHMV Member plan, set by the owner on the server. */
export function getHockeyMemberPriceId(): string {
  return process.env[HOCKEY_MEMBER_PRICE_ENV]?.trim() ?? "";
}

export function getHockeyMembershipSelfServeEnabled(): boolean {
  return process.env.HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED === "true";
}

export function isHockeyMembershipCheckoutLive(): boolean {
  return resolveHockeyCheckoutLive({
    enabled: getHockeyMembershipSelfServeEnabled(),
    secretKey: getStripeSecretKey(),
    webhookSecret: getHockeyStripeWebhookSecret(),
  });
}
