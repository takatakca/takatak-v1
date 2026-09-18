/**
 * Isolated checks for Social Stripe add-ons.
 * No Stripe API. No database.
 */

import {
  SOCIAL_ADDON_CATALOG,
  socialStripeAddonPriceEnvKey,
  socialStripeAddonPriceEnvKeys,
  socialStripeAddonPriceMapEnvKeys,
} from '../src/lib/billing/social/addon-catalog';
import { resolveSocialEntitlements } from '../src/lib/billing/social/entitlements';
import {
  resolveSocialStripeAddonChange,
  validateSocialStripeAddonInput,
} from '../src/lib/billing/social/stripe-addon-policy';
import {
  interpretStripeSubscriptionEvent,
  resolveAddonsFromStripe,
  socialUnsubscribedSubscriptionPatch,
} from '../src/lib/billing/social/stripe-webhook-policy';

type Row = {
  name: string;
  ok: boolean;
  detail: string;
};

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });

  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

const priceMap = {
  price_starter5: {
    planCode: 'social_starter_5' as const,
    cycle: 'monthly' as const,
  },
  price_x: {
    addonCode: 'x_account' as const,
    cycle: 'monthly' as const,
  },
  price_analytics: {
    addonCode: 'advanced_analytics' as const,
    cycle: 'monthly' as const,
  },
};

function main() {
  check(
    'X add-on env key',
    socialStripeAddonPriceEnvKey('x_account', 'monthly') ===
      'STRIPE_PRICE_SOCIAL_ADDON_X_ACCOUNT_MONTHLY',
    'X Price IDs must use the add-on slug',
  );

  const selfServePriceKeys = socialStripeAddonPriceEnvKeys();
  const webhookPriceKeys = socialStripeAddonPriceMapEnvKeys();

  check(
    'only X Price IDs enable self-service add-on checkout',
    selfServePriceKeys.includes(
      'STRIPE_PRICE_SOCIAL_ADDON_X_ACCOUNT_MONTHLY',
    ) &&
      selfServePriceKeys.includes(
        'STRIPE_PRICE_SOCIAL_ADDON_X_ACCOUNT_ANNUAL',
      ) &&
      !selfServePriceKeys.some((key) => key.includes('ADVANCED_ANALYTICS')),
    'Advanced Analytics must not enable customer self-service checkout',
  );

  check(
    'webhook mapping recognizes contracted Analytics prices',
    webhookPriceKeys.includes(
      socialStripeAddonPriceEnvKey('advanced_analytics', 'monthly'),
    ) &&
      webhookPriceKeys.includes(
        socialStripeAddonPriceEnvKey('advanced_analytics', 'annual'),
      ),
    'optional contracted Analytics prices must remain webhook-compatible',
  );

  check(
    'official add-on pricing matches the catalogue',
    SOCIAL_ADDON_CATALOG.x_account.displayMonthlyCad === 33.92 &&
      Math.abs(
        SOCIAL_ADDON_CATALOG.x_account.displayAnnualMonthlyCad * 12 - 366.34,
      ) < 0.001 &&
      SOCIAL_ADDON_CATALOG.advanced_analytics.displayMonthlyCad === 0 &&
      SOCIAL_ADDON_CATALOG.advanced_analytics.displayAnnualMonthlyCad === 0,
    'X must use official CAD pricing and Analytics must remain quote-based',
  );

  const unsubscribedEntitlements = resolveSocialEntitlements({
    planCode: 'social_unsubscribed',
  });

  const unsubscribedDenied = resolveSocialStripeAddonChange({
    access: 'blocked',
    entitlements: unsubscribedEntitlements,
    hasStripeSubscription: false,
    addonCode: 'x_account',
    action: 'add',
  });

  check(
    'unsubscribed workspace cannot buy X',
    unsubscribedDenied.kind === 'forbidden',
    'a paid base subscription is required before add-ons',
  );

  const starter = resolveSocialEntitlements({
    planCode: 'social_starter_5',
    addOns: {
      xAccountAllowance: 1,
      advancedAnalytics: false,
    },
  });

  const addX = resolveSocialStripeAddonChange({
    access: 'paid',
    entitlements: starter,
    hasStripeSubscription: true,
    addonCode: 'x_account',
    action: 'add',
  });

  check(
    'Starter can add an X slot now',
    addX.kind === 'update_now' && addX.xAccountAllowance === 2,
    'adding X is prorated immediately',
  );

  const removeX = resolveSocialStripeAddonChange({
    access: 'paid',
    entitlements: starter,
    hasStripeSubscription: true,
    addonCode: 'x_account',
    action: 'remove',
  });

  check(
    'Removing an X slot waits until period end',
    removeX.kind === 'schedule_period_end' && removeX.xAccountAllowance === 0,
    'remove must not drop the slot until renewal',
  );

  const addAnalytics = resolveSocialStripeAddonChange({
    access: 'paid',
    entitlements: starter,
    hasStripeSubscription: true,
    addonCode: 'advanced_analytics',
    action: 'add',
  });

  check(
    'Advanced Analytics cannot be purchased through self-service',
    addAnalytics.kind === 'forbidden',
    'Advanced Analytics must direct the customer to TAKATAK support',
  );

  const alreadyAnalytics = resolveSocialStripeAddonChange({
    access: 'paid',
    entitlements: resolveSocialEntitlements({
      planCode: 'social_starter_5',
      addOns: {
        advancedAnalytics: true,
      },
    }),
    hasStripeSubscription: true,
    addonCode: 'advanced_analytics',
    action: 'add',
  });

  check(
    'contracted Analytics changes still require support',
    alreadyAnalytics.kind === 'forbidden',
    'customers cannot directly add or remove the contracted package',
  );

  const noStripe = resolveSocialStripeAddonChange({
    access: 'paid',
    entitlements: starter,
    hasStripeSubscription: false,
    addonCode: 'x_account',
    action: 'add',
  });

  check(
    'Paid without Stripe subscription cannot self-serve add-ons',
    noStripe.kind === 'forbidden',
    'Custom or non-Stripe paid plans stay Talk to us for add-ons',
  );

  const invalid = validateSocialStripeAddonInput({
    addonCode: 'nope',
    action: 'add',
  });

  check(
    'Unknown add-on is rejected',
    invalid.success === false,
    'only supported add-on codes may be submitted',
  );

  const quotedAnalytics = validateSocialStripeAddonInput({
    addonCode: 'advanced_analytics',
    action: 'add',
  });

  check(
    'Advanced Analytics API request is rejected',
    quotedAnalytics.success === false,
    'Advanced Analytics must use the custom quote workflow',
  );

  const addons = resolveAddonsFromStripe(
    {
      id: 'sub_1',
      status: 'active',
      items: {
        data: [
          {
            price: {
              id: 'price_starter5',
            },
            quantity: 1,
          },
          {
            price: {
              id: 'price_x',
            },
            quantity: 2,
          },
          {
            price: {
              id: 'price_analytics',
            },
            quantity: 1,
          },
        ],
      },
    },
    priceMap,
  );

  check(
    'Webhook items set two X slots and analytics',
    addons.xAccountAllowance === 2 && addons.advancedAnalytics === true,
    'add-ons come from Stripe item quantities',
  );

  const applied = interpretStripeSubscriptionEvent(
    {
      id: 'sub_1',
      status: 'active',
      customer: 'cus_1',
      metadata: {
        planCode: 'social_starter_5',
      },
      items: {
        data: [
          {
            price: {
              id: 'price_starter5',
            },
            quantity: 1,
          },
          {
            price: {
              id: 'price_x',
            },
            quantity: 2,
          },
        ],
      },
    },
    priceMap,
  );

  check(
    'Paid webhook writes add-ons onto the patch',
    applied.action === 'apply' &&
      applied.patch.xAccountAllowance === 2 &&
      applied.patch.advancedAnalytics === false,
    'plan webhook must copy X quantity and leave analytics off',
  );

  const unsubscribed = socialUnsubscribedSubscriptionPatch({
    externalCustomerId: 'cus_1',
  });

  check(
    'unsubscribed fallback clears add-ons',
    unsubscribed.xAccountAllowance === 0 &&
      unsubscribed.advancedAnalytics === false,
    'blocked workspaces must not retain paid add-ons',
  );

  console.log(`verify-social-stripe-addons: ${rows.length} checks passed`);
}

main();
