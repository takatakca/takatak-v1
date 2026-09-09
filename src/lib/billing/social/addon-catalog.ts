import type { SocialAddonCode } from "./types";

/**
 * Social add-ons. CAD figures are placeholders until Stripe Price IDs exist.
 * Sold only on Starter / Advanced / Custom. Ignored on Free.
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
    addonCode: "x_account",
    name: "X add-on",
    displayMonthlyCad: 15,
    displayAnnualMonthlyCad: 12,
  },
  advanced_analytics: {
    addonCode: "advanced_analytics",
    name: "Advanced Analytics",
    displayMonthlyCad: 29,
    displayAnnualMonthlyCad: 23,
  },
};

export const SOCIAL_X_SLOT_MAX = 50;

export function socialStripeAddonPriceEnvKey(
  addonCode: SocialAddonCode,
  cycle: "monthly" | "annual",
): string {
  const slug = addonCode.toUpperCase();
  return `STRIPE_PRICE_SOCIAL_ADDON_${slug}_${cycle.toUpperCase()}`;
}

export function socialStripeAddonPriceEnvKeys(): string[] {
  return (["x_account", "advanced_analytics"] as const).flatMap((addonCode) => [
    socialStripeAddonPriceEnvKey(addonCode, "monthly"),
    socialStripeAddonPriceEnvKey(addonCode, "annual"),
  ]);
}
