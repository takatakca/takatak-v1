/**
 * Isolated checks for Social Stripe add-ons.
 * No Stripe API. No database.
 */

import { SOCIAL_ADDON_CATALOG, socialStripeAddonPriceEnvKey } from "../src/lib/billing/social/addon-catalog";
import { resolveSocialEntitlements } from "../src/lib/billing/social/entitlements";
import {
  resolveSocialStripeAddonChange,
  validateSocialStripeAddonInput,
} from "../src/lib/billing/social/stripe-addon-policy";
import {
  interpretStripeSubscriptionEvent,
  resolveAddonsFromStripe,
  socialFreeSubscriptionPatch,
} from "../src/lib/billing/social/stripe-webhook-policy";

type Row = { name: string; ok: boolean; detail: string };

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

const priceMap = {
  price_starter5: { planCode: "social_starter_5" as const, cycle: "monthly" as const },
  price_x: { addonCode: "x_account" as const, cycle: "monthly" as const },
  price_analytics: {
    addonCode: "advanced_analytics" as const,
    cycle: "monthly" as const,
  },
};

function main() {
  check(
    "X add-on env key",
    socialStripeAddonPriceEnvKey("x_account", "monthly") ===
      "STRIPE_PRICE_SOCIAL_ADDON_X_ACCOUNT_MONTHLY",
    "X Price IDs must use the add-on slug",
  );

  check(
    "Analytics add-on env key",
    socialStripeAddonPriceEnvKey("advanced_analytics", "annual") ===
      "STRIPE_PRICE_SOCIAL_ADDON_ADVANCED_ANALYTICS_ANNUAL",
    "Analytics Price IDs must use the add-on slug",
  );

  check(
    "placeholder CAD exists",
    SOCIAL_ADDON_CATALOG.x_account.displayMonthlyCad > 0 &&
      SOCIAL_ADDON_CATALOG.advanced_analytics.displayMonthlyCad > 0,
    "catalog must show placeholder prices",
  );

  const freeEntitlements = resolveSocialEntitlements({
    planCode: "social_free",
  });
  const freeDenied = resolveSocialStripeAddonChange({
    access: "free",
    entitlements: freeEntitlements,
    hasStripeSubscription: false,
    addonCode: "x_account",
    action: "add",
  });
  check(
    "Free cannot buy X",
    freeDenied.kind === "forbidden",
    "Free must upgrade before add-ons",
  );

  const starter = resolveSocialEntitlements({
    planCode: "social_starter_5",
    addOns: { xAccountAllowance: 1, advancedAnalytics: false },
  });
  const addX = resolveSocialStripeAddonChange({
    access: "paid",
    entitlements: starter,
    hasStripeSubscription: true,
    addonCode: "x_account",
    action: "add",
  });
  check(
    "Starter can add an X slot now",
    addX.kind === "update_now" && addX.xAccountAllowance === 2,
    "adding X is prorated immediately",
  );

  const removeX = resolveSocialStripeAddonChange({
    access: "paid",
    entitlements: starter,
    hasStripeSubscription: true,
    addonCode: "x_account",
    action: "remove",
  });
  check(
    "Removing an X slot waits until period end",
    removeX.kind === "schedule_period_end" && removeX.xAccountAllowance === 0,
    "remove must not drop the slot until renewal",
  );

  const addAnalytics = resolveSocialStripeAddonChange({
    access: "paid",
    entitlements: starter,
    hasStripeSubscription: true,
    addonCode: "advanced_analytics",
    action: "add",
  });
  check(
    "Starter can add Advanced Analytics now",
    addAnalytics.kind === "update_now" && addAnalytics.advancedAnalytics === true,
    "analytics add-on is workspace-wide and immediate",
  );

  const alreadyAnalytics = resolveSocialStripeAddonChange({
    access: "paid",
    entitlements: resolveSocialEntitlements({
      planCode: "social_starter_5",
      addOns: { advancedAnalytics: true },
    }),
    hasStripeSubscription: true,
    addonCode: "advanced_analytics",
    action: "add",
  });
  check(
    "Cannot buy Analytics twice",
    alreadyAnalytics.kind === "conflict",
    "already contracted analytics must not checkout again",
  );

  const noStripe = resolveSocialStripeAddonChange({
    access: "paid",
    entitlements: starter,
    hasStripeSubscription: false,
    addonCode: "x_account",
    action: "add",
  });
  check(
    "Paid without Stripe subscription cannot self-serve add-ons",
    noStripe.kind === "forbidden",
    "Custom / non-Stripe paid plans stay Talk to us for add-ons",
  );

  const invalid = validateSocialStripeAddonInput({ addonCode: "nope", action: "add" });
  check(
    "Unknown add-on is rejected",
    invalid.success === false,
    "only x_account and advanced_analytics",
  );

  const addons = resolveAddonsFromStripe(
    {
      id: "sub_1",
      status: "active",
      items: {
        data: [
          { price: { id: "price_starter5" }, quantity: 1 },
          { price: { id: "price_x" }, quantity: 2 },
          { price: { id: "price_analytics" }, quantity: 1 },
        ],
      },
    },
    priceMap,
  );
  check(
    "Webhook items set two X slots and analytics",
    addons.xAccountAllowance === 2 && addons.advancedAnalytics === true,
    "add-ons come from Stripe item quantities",
  );

  const applied = interpretStripeSubscriptionEvent(
    {
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      metadata: { planCode: "social_starter_5" },
      items: {
        data: [
          { price: { id: "price_starter5" }, quantity: 1 },
          { price: { id: "price_x" }, quantity: 2 },
        ],
      },
    },
    priceMap,
  );
  check(
    "Paid webhook writes add-ons onto the patch",
    applied.action === "apply" &&
      applied.patch.xAccountAllowance === 2 &&
      applied.patch.advancedAnalytics === false,
    "plan webhook must copy X quantity and leave analytics off",
  );

  const freed = socialFreeSubscriptionPatch({ externalCustomerId: "cus_1" });
  check(
    "Free fallback clears add-ons",
    freed.xAccountAllowance === 0 && freed.advancedAnalytics === false,
    "failed retries must not leave paid add-ons on Free",
  );

  console.log(`verify-social-stripe-addons: ${rows.length} checks passed`);
}

main();
