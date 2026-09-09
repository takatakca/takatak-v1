/**
 * Social billing types. The Client (workspace) owns the plan.
 * Brands and member roles are not billed here.
 */

export const SOCIAL_PLAN_CODES = [
  "social_free",
  "social_starter_5",
  "social_starter_10",
  "social_advanced_15",
  "social_advanced_25",
  "social_advanced_50",
  "social_custom",
] as const;

export type SocialPlanCode = (typeof SOCIAL_PLAN_CODES)[number];

export const SOCIAL_BILLING_NETWORKS = [
  "facebook",
  "instagram",
  "threads",
  "tiktok",
  "google_business",
  "linkedin",
  "x",
  "youtube",
  "pinterest",
  "bluesky",
  "twitch",
] as const;

export type SocialBillingNetwork = (typeof SOCIAL_BILLING_NETWORKS)[number];

export const SOCIAL_ADDON_CODES = [
  "x_account",
  "advanced_analytics",
] as const;

export type SocialAddonCode = (typeof SOCIAL_ADDON_CODES)[number];

export type SocialAddonState = {
  /** Paid X/Twitter slots. One slot per connected X account. */
  xAccountAllowance: number;
  /** Account-wide analytics/studio add-on. */
  advancedAnalytics: boolean;
};

export type SocialEntitlements = {
  planCode: SocialPlanCode;
  planName: string;
  /** How many Brands may stay active. */
  brandAllowance: number;
  allowedNetworks: readonly SocialBillingNetwork[];
  /** null = unlimited / fair use. */
  monthlyPostAllowance: number | null;
  /** null = no 30-day Free window. */
  analyticsHistoryDays: number | null;
  competitorAllowance: number;
  reports: boolean;
  teamManagement: boolean;
  customRoles: boolean;
  approvals: boolean;
  apiAccess: boolean;
  eligibleAddons: readonly SocialAddonCode[];
  /** Effective X slots after add-ons (0 on Free). */
  xConnectionAllowance: number;
  advancedAnalytics: boolean;
  /**
   * Placeholder CAD list price. Charged only when Stripe Price IDs exist.
   * Annual is stored as the monthly equivalent shown on pricing pages.
   */
  displayMonthlyCad: number;
  displayAnnualMonthlyCad: number;
};

export type ResolveSocialEntitlementsInput = {
  planCode?: string | null;
  addOns?: Partial<SocialAddonState>;
  /** Custom plan only. Ignored for named plans. */
  customBrandAllowance?: number;
};
