import "server-only";

import { resolveHockeyCheckoutLive } from "./membership-policy";
import { getStripeSecretKey } from "@/lib/billing/social/stripe-env";

export function getHockeyStripeWebhookSecret(): string {
  return process.env.STRIPE_HOCKEY_WEBHOOK_SECRET?.trim() ?? "";
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
