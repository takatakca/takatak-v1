/**
 * Pure billing banner and lock-copy helpers. No database. No Stripe.
 */

import { canConnectSocialNetwork } from "./entitlements";
import type { SocialEntitlements } from "./types";
import type { SocialSubscriptionAccess } from "./subscription-lifecycle";

export const SOCIAL_BILLING_HREF =
  "/dashboard/social/settings?tab=billing";

export type SocialBillingBannerTone = "info" | "warning" | "danger";

export type SocialBillingBannerModel = {
  tone: SocialBillingBannerTone;
  title: string;
  body: string;
  actionLabel: string;
};

export type ResolveSocialBillingBannerInput = {
  access: SocialSubscriptionAccess;
  statusLabel: string;
  planName: string;
  cancelAtPeriodEnd: boolean;
  periodEndLabel: string | null;
  overAllowance: boolean;
  brandAllowance: number;
  billableCount: number;
};

export type SocialFeatureLockRow = {
  id: string;
  feature: string;
  included: boolean;
  unlock: string;
};

export function resolveSocialBillingBanner(
  input: ResolveSocialBillingBannerInput,
): SocialBillingBannerModel | null {
  if (input.access === "blocked") {
    return {
      tone: "danger",
      title: "Social is locked",
      body: "This workspace cannot use Social until billing is restored. Brands and posts were not deleted.",
      actionLabel: "View billing",
    };
  }

  if (
    input.statusLabel === "Payment past due" ||
    input.statusLabel === "Payment retry"
  ) {
    return {
      tone: "warning",
      title: "Payment failed",
      body: "Access stays on while retries run. Update the payment method to keep this plan.",
      actionLabel: "View billing",
    };
  }

  if (input.overAllowance) {
    return {
      tone: "warning",
      title: "Too many active brands",
      body: `This plan allows ${input.brandAllowance} active brand${input.brandAllowance === 1 ? "" : "s"}. You have ${input.billableCount}. Choose which stay live. The rest freeze, not delete.`,
      actionLabel: "Choose brands",
    };
  }

  if (input.cancelAtPeriodEnd && input.periodEndLabel) {
    return {
      tone: "info",
      title: "Plan cancels at period end",
      body: `Paid access continues until ${input.periodEndLabel}. After that this workspace returns to Free.`,
      actionLabel: "View billing",
    };
  }

  return null;
}

export function socialFeatureLockRows(
  entitlements: SocialEntitlements,
): SocialFeatureLockRow[] {
  const xIncluded = canConnectSocialNetwork(entitlements, "x");
  const linkedInIncluded = canConnectSocialNetwork(entitlements, "linkedin");

  return [
    {
      id: "linkedin",
      feature: "LinkedIn",
      included: linkedInIncluded,
      unlock: linkedInIncluded
        ? "Included on this plan"
        : "Starter or Advanced",
    },
    {
      id: "x",
      feature: "X",
      included: xIncluded,
      unlock: xIncluded
        ? `${entitlements.xConnectionAllowance} paid slot${entitlements.xConnectionAllowance === 1 ? "" : "s"}`
        : entitlements.eligibleAddons.includes("x_account")
          ? "X add-on"
          : "Starter+ with the X add-on",
    },
    {
      id: "brands",
      feature: "Active brands",
      included: entitlements.brandAllowance > 1,
      unlock:
        entitlements.brandAllowance > 1
          ? `Up to ${entitlements.brandAllowance}`
          : "Starter (5+) or Advanced",
    },
    {
      id: "posts",
      feature: "Monthly posts",
      included: entitlements.monthlyPostAllowance === null,
      unlock:
        entitlements.monthlyPostAllowance === null
          ? "Unlimited / fair use"
          : `${entitlements.monthlyPostAllowance} on Free · Starter unlocks unlimited`,
    },
    {
      id: "analytics",
      feature: "Analytics history",
      included: entitlements.analyticsHistoryDays === null,
      unlock:
        entitlements.analyticsHistoryDays === null
          ? "Full history"
          : `${entitlements.analyticsHistoryDays} days on Free · Starter unlocks the full window`,
    },
    {
      id: "reports",
      feature: "Reports",
      included: entitlements.reports,
      unlock: entitlements.reports ? "Included on this plan" : "Starter or Advanced",
    },
    {
      id: "teams",
      feature: "Teams, roles, and approvals",
      included: entitlements.teamManagement,
      unlock: entitlements.teamManagement
        ? "Included on this plan"
        : "Advanced or Custom",
    },
    {
      id: "api",
      feature: "API access",
      included: entitlements.apiAccess,
      unlock: entitlements.apiAccess
        ? "Included on this plan"
        : "Advanced or Custom",
    },
  ];
}
