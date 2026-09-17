import type {
  SocialAddonCode,
  SocialBillingNetwork,
  SocialPlanCode,
} from './types';

const ESSENTIAL_NETWORKS: readonly SocialBillingNetwork[] = [
  'facebook',
  'instagram',
  'threads',
  'tiktok',
  'google_business',
  'youtube',
  'pinterest',
  'bluesky',
  'twitch',
];

const PAID_NETWORKS: readonly SocialBillingNetwork[] = [
  ...ESSENTIAL_NETWORKS,
  'linkedin',
];

type CatalogEntry = {
  planCode: SocialPlanCode;
  planName: string;
  brandAllowance: number;
  allowedNetworks: readonly SocialBillingNetwork[];
  monthlyPostAllowance: number | null;
  analyticsHistoryDays: number | null;
  competitorAllowance: number;
  reports: boolean;
  teamManagement: boolean;
  customRoles: boolean;
  approvals: boolean;
  apiAccess: boolean;
  eligibleAddons: readonly SocialAddonCode[];
  displayMonthlyCad: number;
  /**
   * Monthly equivalent displayed when the customer chooses annual billing.
   * The annual Stripe charge is this value multiplied by 12.
   */
  displayAnnualMonthlyCad: number;
};

const STARTER_FEATURES = {
  allowedNetworks: PAID_NETWORKS,
  monthlyPostAllowance: null,
  analyticsHistoryDays: null,
  competitorAllowance: 100,
  reports: true,
  teamManagement: false,
  customRoles: false,
  approvals: false,
  apiAccess: false,
  eligibleAddons: ['x_account', 'advanced_analytics'] as const,
};

const ADVANCED_FEATURES = {
  ...STARTER_FEATURES,
  teamManagement: true,
  customRoles: true,
  approvals: true,
  apiAccess: true,
};

/**
 * Social plans priced in CAD before applicable taxes.
 *
 * The billing unit is the number of active Brands on the Client workspace.
 * Annual self-serve plans receive a 10% discount.
 *
 * social_unsubscribed is an internal zero-access state. It is never sold
 * through Stripe and must never be presented as a free plan.
 */
export const SOCIAL_PLAN_CATALOG: Record<SocialPlanCode, CatalogEntry> = {
  social_unsubscribed: {
    planCode: 'social_unsubscribed',
    planName: 'No Social subscription',
    brandAllowance: 0,
    allowedNetworks: [],
    monthlyPostAllowance: 0,
    analyticsHistoryDays: 0,
    competitorAllowance: 0,
    reports: false,
    teamManagement: false,
    customRoles: false,
    approvals: false,
    apiAccess: false,
    eligibleAddons: [],
    displayMonthlyCad: 0,
    displayAnnualMonthlyCad: 0,
  },

  social_essential_1: {
    planCode: 'social_essential_1',
    planName: 'Social Essential',
    brandAllowance: 1,
    allowedNetworks: ESSENTIAL_NETWORKS,
    monthlyPostAllowance: 20,
    analyticsHistoryDays: 30,
    competitorAllowance: 5,
    reports: false,
    teamManagement: false,
    customRoles: false,
    approvals: false,
    apiAccess: false,
    eligibleAddons: [],
    displayMonthlyCad: 20,
    displayAnnualMonthlyCad: 20 * 0.9,
  },

  social_starter_5: {
    planCode: 'social_starter_5',
    planName: 'Starter 5',
    brandAllowance: 5,
    ...STARTER_FEATURES,
    displayMonthlyCad: 54.79,
    displayAnnualMonthlyCad: 54.79 * 0.9,
  },

  social_starter_10: {
    planCode: 'social_starter_10',
    planName: 'Starter 10',
    brandAllowance: 10,
    ...STARTER_FEATURES,
    displayMonthlyCad: 82.63,
    displayAnnualMonthlyCad: 82.63 * 0.9,
  },

  social_advanced_15: {
    planCode: 'social_advanced_15',
    planName: 'Advanced 15',
    brandAllowance: 15,
    ...ADVANCED_FEATURES,
    displayMonthlyCad: 113.24,
    displayAnnualMonthlyCad: 113.24 * 0.9,
  },

  social_advanced_25: {
    planCode: 'social_advanced_25',
    planName: 'Advanced 25',
    brandAllowance: 25,
    ...ADVANCED_FEATURES,
    displayMonthlyCad: 168.91,
    displayAnnualMonthlyCad: 168.91 * 0.9,
  },

  social_advanced_50: {
    planCode: 'social_advanced_50',
    planName: 'Advanced 50',
    brandAllowance: 50,
    ...ADVANCED_FEATURES,
    displayMonthlyCad: 312.26,
    displayAnnualMonthlyCad: 312.26 * 0.9,
  },

  social_custom: {
    planCode: 'social_custom',
    planName: 'Custom',
    brandAllowance: 50,
    ...ADVANCED_FEATURES,
    displayMonthlyCad: 0,
    displayAnnualMonthlyCad: 0,
  },
};

export const SOCIAL_UNSUBSCRIBED_PLAN_CODE: SocialPlanCode =
  'social_unsubscribed';

export const SOCIAL_UNSUBSCRIBED_PLAN_NAME =
  SOCIAL_PLAN_CATALOG.social_unsubscribed.planName;

export const SOCIAL_ESSENTIAL_PLAN_CODE: SocialPlanCode = 'social_essential_1';

export const SOCIAL_ESSENTIAL_PLAN_NAME =
  SOCIAL_PLAN_CATALOG.social_essential_1.planName;

export const ESSENTIAL_PLAN_CODES = ['social_essential_1'] as const;

export const STARTER_PLAN_CODES = [
  'social_starter_5',
  'social_starter_10',
] as const;

export const ADVANCED_PLAN_CODES = [
  'social_advanced_15',
  'social_advanced_25',
  'social_advanced_50',
] as const;

/**
 * Plans available through self-serve Stripe Checkout.
 * Custom plans remain sales-only.
 */
export const PAID_CHECKOUT_PLAN_CODES = [
  ...ESSENTIAL_PLAN_CODES,
  ...STARTER_PLAN_CODES,
  ...ADVANCED_PLAN_CODES,
] as const;

export type PaidCheckoutPlanCode = (typeof PAID_CHECKOUT_PLAN_CODES)[number];

export function isPaidCheckoutPlanCode(
  value: string | null | undefined,
): value is PaidCheckoutPlanCode {
  return (
    typeof value === 'string' &&
    (PAID_CHECKOUT_PLAN_CODES as readonly string[]).includes(value)
  );
}

export function planFamily(
  planCode: SocialPlanCode,
): 'unsubscribed' | 'essential' | 'starter' | 'advanced' | 'custom' {
  if (planCode === 'social_unsubscribed') {
    return 'unsubscribed';
  }

  if (planCode === 'social_essential_1') {
    return 'essential';
  }

  if (planCode === 'social_custom') {
    return 'custom';
  }

  if ((STARTER_PLAN_CODES as readonly string[]).includes(planCode)) {
    return 'starter';
  }

  return 'advanced';
}

export function annualSavingsPercent(): number {
  const monthly = SOCIAL_PLAN_CATALOG.social_essential_1.displayMonthlyCad;

  const annualMonthly =
    SOCIAL_PLAN_CATALOG.social_essential_1.displayAnnualMonthlyCad;

  if (monthly <= 0) {
    return 0;
  }

  return Math.round(((monthly - annualMonthly) / monthly) * 100);
}

export function isSocialPlanCode(
  value: string | null | undefined,
): value is SocialPlanCode {
  if (!value) {
    return false;
  }

  return value in SOCIAL_PLAN_CATALOG;
}

export function essentialPlanHighlights(): string[] {
  return paidPlanHighlights(SOCIAL_PLAN_CATALOG.social_essential_1);
}

export function starterPlanHighlights(): string[] {
  return paidPlanHighlights(SOCIAL_PLAN_CATALOG.social_starter_5);
}

export function advancedPlanHighlights(): string[] {
  return [
    'Everything in Starter',
    ...advancedOnlyHighlights(SOCIAL_PLAN_CATALOG.social_advanced_15),
  ];
}

export function customPlanHighlights(): string[] {
  return [
    'Custom number of brands',
    ...advancedOnlyHighlights(SOCIAL_PLAN_CATALOG.social_custom),
  ];
}

function paidPlanHighlights(plan: CatalogEntry): string[] {
  const items: string[] = [];

  if (plan.monthlyPostAllowance === null) {
    items.push('Unlimited monthly publications');
  } else {
    items.push(`${plan.monthlyPostAllowance} publications / month`);
  }

  items.push(`${plan.competitorAllowance} competitor analysis`);

  if (plan.analyticsHistoryDays !== null) {
    items.push(`${plan.analyticsHistoryDays} days of analytics history`);
  }

  if (plan.eligibleAddons.includes('x_account')) {
    items.push('Access to X add-on');
  }

  if (plan.allowedNetworks.includes('linkedin')) {
    items.push('LinkedIn connection');
  }

  if (plan.reports) {
    items.push('Reports');
  }

  return items;
}

function advancedOnlyHighlights(plan: CatalogEntry): string[] {
  const items: string[] = [];

  if (plan.teamManagement) {
    items.push('Team and client management');
  }

  if (plan.customRoles) {
    items.push('Role management');
  }

  if (plan.approvals) {
    items.push('Content approval system');
  }

  if (plan.apiAccess) {
    items.push('TAKATAK API');
  }

  return items;
}
