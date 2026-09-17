import type { SocialAddonCode } from './types';

/**
 * Social add-ons.
 *
 * X is self-service through Stripe on eligible paid plans.
 * Advanced Analytics requires a custom quote and is not self-service.
 */
export const SOCIAL_ADDON_CATALOG: Record<
  SocialAddonCode,
  {
    addonCode: SocialAddonCode;
    name: string;
    displayMonthlyCad: number;
    displayAnnualMonthlyCad: number;
  }
> = {
  x_account: {
    addonCode: 'x_account',
    name: 'X add-on',
    displayMonthlyCad: 33.92,
    displayAnnualMonthlyCad: 366.34 / 12,
  },

  advanced_analytics: {
    addonCode: 'advanced_analytics',
    name: 'Advanced Analytics',
    displayMonthlyCad: 0,
    displayAnnualMonthlyCad: 0,
  },
};

export const SOCIAL_X_SLOT_MAX = 50;

export function socialStripeAddonPriceEnvKey(
  addonCode: SocialAddonCode,
  cycle: 'monthly' | 'annual',
): string {
  const slug = addonCode.toUpperCase();

  return `STRIPE_PRICE_SOCIAL_ADDON_${slug}_${cycle.toUpperCase()}`;
}

/**
 * Price IDs required to enable customer self-service add-on checkout.
 * Only X is directly purchasable from the billing interface.
 */
export function socialStripeAddonPriceEnvKeys(): string[] {
  return [
    socialStripeAddonPriceEnvKey('x_account', 'monthly'),
    socialStripeAddonPriceEnvKey('x_account', 'annual'),
  ];
}

/**
 * Every optional Price ID that Stripe webhooks may recognize.
 *
 * Advanced Analytics remains here because TAKATAK may configure its
 * contracted price after the customer accepts a custom quote.
 */
export function socialStripeAddonPriceMapEnvKeys(): string[] {
  return (['x_account', 'advanced_analytics'] as const).flatMap((addonCode) => [
    socialStripeAddonPriceEnvKey(addonCode, 'monthly'),
    socialStripeAddonPriceEnvKey(addonCode, 'annual'),
  ]);
}
