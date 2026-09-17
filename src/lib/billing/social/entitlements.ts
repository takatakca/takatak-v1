import {
  SOCIAL_PLAN_CATALOG,
  SOCIAL_UNSUBSCRIBED_PLAN_CODE,
  isSocialPlanCode,
} from './plan-catalog';

import type {
  ResolveSocialEntitlementsInput,
  SocialAddonState,
  SocialBillingNetwork,
  SocialEntitlements,
  SocialPlanCode,
} from './types';

const EMPTY_ADDONS: SocialAddonState = {
  xAccountAllowance: 0,
  advancedAnalytics: false,
};

function normalizeAddOns(
  addOns: Partial<SocialAddonState> | undefined,
): SocialAddonState {
  const xAccountAllowance = Math.max(
    0,
    Math.floor(addOns?.xAccountAllowance ?? EMPTY_ADDONS.xAccountAllowance),
  );

  return {
    xAccountAllowance,
    advancedAnalytics: Boolean(addOns?.advancedAnalytics),
  };
}

function resolvePlanCode(planCode: string | null | undefined): SocialPlanCode {
  if (isSocialPlanCode(planCode)) {
    return planCode;
  }

  return SOCIAL_UNSUBSCRIBED_PLAN_CODE;
}

/**
 * Pure entitlement resolution.
 *
 * Unknown, legacy, or missing plan codes resolve to the internal
 * zero-access unsubscribed state. No paid access is invented.
 */
export function resolveSocialEntitlements(
  input: ResolveSocialEntitlementsInput = {},
): SocialEntitlements {
  const planCode = resolvePlanCode(input.planCode);
  const plan = SOCIAL_PLAN_CATALOG[planCode];
  const addOns = normalizeAddOns(input.addOns);

  const brandAllowance =
    planCode === 'social_custom' &&
    typeof input.customBrandAllowance === 'number' &&
    input.customBrandAllowance >= 50
      ? Math.floor(input.customBrandAllowance)
      : plan.brandAllowance;

  const xEligible = plan.eligibleAddons.includes('x_account');

  const analyticsEligible = plan.eligibleAddons.includes('advanced_analytics');

  const xConnectionAllowance = xEligible ? addOns.xAccountAllowance : 0;

  const advancedAnalytics = analyticsEligible && addOns.advancedAnalytics;

  return {
    planCode,
    planName: plan.planName,
    brandAllowance,
    allowedNetworks: plan.allowedNetworks,
    monthlyPostAllowance: plan.monthlyPostAllowance,
    analyticsHistoryDays: plan.analyticsHistoryDays,
    competitorAllowance: plan.competitorAllowance,
    reports: plan.reports,
    teamManagement: plan.teamManagement,
    customRoles: plan.customRoles,
    approvals: plan.approvals,
    apiAccess: plan.apiAccess,
    eligibleAddons: plan.eligibleAddons,
    xConnectionAllowance,
    advancedAnalytics,
    displayMonthlyCad: plan.displayMonthlyCad,
    displayAnnualMonthlyCad: plan.displayAnnualMonthlyCad,
  };
}

export function canConnectSocialNetwork(
  entitlements: SocialEntitlements,
  network: SocialBillingNetwork,
): boolean {
  if (network === 'x') {
    return entitlements.xConnectionAllowance > 0;
  }

  return entitlements.allowedNetworks.includes(network);
}

export function isUnlimitedPublishing(
  entitlements: SocialEntitlements,
): boolean {
  return entitlements.monthlyPostAllowance === null;
}
