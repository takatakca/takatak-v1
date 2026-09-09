import "server-only";

import {
  resolveSocialCheckoutLive,
  socialStripePriceEnvKey,
  socialStripePriceEnvKeys,
  type SocialBillingCycle,
} from "./stripe-checkout-policy";
import {
  socialStripeAddonPriceEnvKey,
  socialStripeAddonPriceEnvKeys,
} from "./addon-catalog";
import type { PaidCheckoutPlanCode } from "./plan-catalog";
import type { SocialAddonCode } from "./types";
import type { StripePricePlanLookup } from "./stripe-webhook-policy";

export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function getSocialStripePriceId(
  planCode: PaidCheckoutPlanCode,
  cycle: SocialBillingCycle,
): string {
  return process.env[socialStripePriceEnvKey(planCode, cycle)]?.trim() ?? "";
}

export function readSocialStripePriceMap(): StripePricePlanLookup {
  const map: StripePricePlanLookup = {};

  for (const key of socialStripePriceEnvKeys()) {
    const priceId = process.env[key]?.trim();
    if (!priceId) {
      continue;
    }

    const match = key.match(/^STRIPE_PRICE_(SOCIAL_.+)_(MONTHLY|ANNUAL)$/);
    if (!match || match[1].startsWith("SOCIAL_ADDON_")) {
      continue;
    }

    const planCode = match[1].toLowerCase();
    const cycle = match[2] === "ANNUAL" ? "annual" : "monthly";
    map[priceId] = {
      planCode: planCode as PaidCheckoutPlanCode,
      cycle,
    };
  }

  for (const key of socialStripeAddonPriceEnvKeys()) {
    const priceId = process.env[key]?.trim();
    if (!priceId) {
      continue;
    }

    const match = key.match(
      /^STRIPE_PRICE_SOCIAL_ADDON_(X_ACCOUNT|ADVANCED_ANALYTICS)_(MONTHLY|ANNUAL)$/,
    );
    if (!match) {
      continue;
    }

    map[priceId] = {
      addonCode:
        match[1] === "X_ACCOUNT" ? "x_account" : "advanced_analytics",
      cycle: match[2] === "ANNUAL" ? "annual" : "monthly",
    };
  }

  return map;
}

export function getSocialStripeAddonPriceId(
  addonCode: SocialAddonCode,
  cycle: SocialBillingCycle,
): string {
  return process.env[socialStripeAddonPriceEnvKey(addonCode, cycle)]?.trim() ?? "";
}

export function isSocialStripeAddonCheckoutLive(): boolean {
  return resolveSocialCheckoutLive({
    secretKey: getStripeSecretKey(),
    webhookSecret: getStripeWebhookSecret(),
    hasPrice: socialStripeAddonPriceEnvKeys().some(
      (key) => Boolean(process.env[key]?.trim()),
    ),
  });
}

export function isSocialStripeCheckoutLive(): boolean {
  const map = readSocialStripePriceMap();
  return resolveSocialCheckoutLive({
    secretKey: getStripeSecretKey(),
    webhookSecret: getStripeWebhookSecret(),
    hasPrice: Object.values(map).some((entry) => Boolean(entry.planCode)),
  });
}
