/**
 * Pure Social entitlement gates. No database. No Stripe.
 * Lifecycle (paid / Free / blocked) is decided first; these answers
 * are the plan questions on top.
 */

import { canConnectSocialNetwork } from "./entitlements";
import type {
  SocialBillingNetwork,
  SocialEntitlements,
} from "./types";
import type { SocialSubscriptionAccess } from "./subscription-lifecycle";

export type EntitlementGateDecision =
  | { allowed: true }
  | { allowed: false; message: string };

export type SocialNetworkConnectInput = {
  provider: string;
  entitlements: SocialEntitlements;
  connectedXCount: number;
  reconnect?: boolean;
};

const PROVIDER_TO_NETWORK: Record<string, SocialBillingNetwork> = {
  meta: "facebook",
  instagram: "instagram",
  threads: "threads",
  google: "youtube",
  linkedin: "linkedin",
  tiktok: "tiktok",
  pinterest: "pinterest",
  x: "x",
  bluesky: "bluesky",
  twitch: "twitch",
};

const BILLABLE_POST_STATUSES = [
  "scheduled",
  "published",
  "pending_approval",
  "approved",
] as const;

export const SOCIAL_BILLABLE_POST_STATUSES: readonly string[] =
  BILLABLE_POST_STATUSES;

function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function utcToday(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function billingNetworkForConnectionProvider(
  provider: string,
): SocialBillingNetwork | null {
  return PROVIDER_TO_NETWORK[provider] ?? null;
}

export function evaluateWorkspaceWriteAccess(
  access: SocialSubscriptionAccess,
): EntitlementGateDecision {
  if (access === "blocked") {
    return {
      allowed: false,
      message: "Social features are not available for this workspace.",
    };
  }

  return { allowed: true };
}

export function evaluateSocialNetworkConnect(
  input: SocialNetworkConnectInput,
): EntitlementGateDecision {
  const network = billingNetworkForConnectionProvider(input.provider);
  if (!network) {
    return {
      allowed: false,
      message: "This social network is not available on the current plan.",
    };
  }

  if (!canConnectSocialNetwork(input.entitlements, network)) {
    if (network === "linkedin") {
      return {
        allowed: false,
        message: "LinkedIn is included on Starter and Advanced plans.",
      };
    }

    if (network === "x") {
      return {
        allowed: false,
        message: "X is an add-on. Add X slots from Plans and billing.",
      };
    }

    return {
      allowed: false,
      message: "This network is not included in the current plan.",
    };
  }

  if (network === "x" && !input.reconnect) {
    const slots = input.entitlements.xConnectionAllowance;
    if (input.connectedXCount >= slots) {
      return {
        allowed: false,
        message: "This workspace has used its X connection slots.",
      };
    }
  }

  return { allowed: true };
}

export function evaluateSchedulePost(input: {
  entitlements: SocialEntitlements;
  usedThisMonth: number;
}): EntitlementGateDecision {
  const cap = input.entitlements.monthlyPostAllowance;
  if (cap === null) {
    return { allowed: true };
  }

  const limit = Math.max(0, Math.floor(cap));
  if (input.usedThisMonth >= limit) {
    return {
      allowed: false,
      message: `This workspace has reached its ${limit} post limit for this month.`,
    };
  }

  return { allowed: true };
}

export function utcMonthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, end };
}

/** Inclusive start of the allowed analytics window, or null when unrestricted. */
export function analyticsHistoryCutoffDate(
  historyDays: number | null,
  now = new Date(),
): string | null {
  if (historyDays === null) {
    return null;
  }

  const days = Math.max(1, Math.floor(historyDays));
  return addUtcDays(utcToday(now), -(days - 1));
}

export type AnalyticsDateRange = {
  start: string;
  end: string;
  compareStart: string | null;
  compareEnd: string | null;
};

export function clipAnalyticsDateRange(
  range: AnalyticsDateRange,
  historyDays: number | null,
  now = new Date(),
): AnalyticsDateRange & { clipped: boolean } {
  const cutoff = analyticsHistoryCutoffDate(historyDays, now);
  if (!cutoff) {
    return { ...range, clipped: false };
  }

  const start = range.start < cutoff ? cutoff : range.start;
  let end = range.end;
  if (end < start) {
    end = start;
  }

  let compareStart = range.compareStart;
  let compareEnd = range.compareEnd;
  if (compareStart && compareEnd) {
    if (compareEnd < cutoff) {
      compareStart = null;
      compareEnd = null;
    } else if (compareStart < cutoff) {
      compareStart = cutoff;
    }
  }

  const clipped =
    start !== range.start ||
    compareStart !== range.compareStart ||
    compareEnd !== range.compareEnd;

  return {
    start,
    end,
    compareStart,
    compareEnd,
    clipped,
  };
}

export function evaluateAddCompetitor(input: {
  entitlements: SocialEntitlements;
  activeCount: number;
}): EntitlementGateDecision {
  const cap = Math.max(0, Math.floor(input.entitlements.competitorAllowance));
  if (input.activeCount >= cap) {
    return {
      allowed: false,
      message:
        cap === 1
          ? "This plan allows 1 competitor per brand."
          : `This plan allows ${cap} competitors per brand.`,
    };
  }

  return { allowed: true };
}

export function evaluateTeamInvite(
  entitlements: SocialEntitlements,
): EntitlementGateDecision {
  if (!entitlements.teamManagement) {
    return {
      allowed: false,
      message: "Team management is included on Advanced plans.",
    };
  }

  return { allowed: true };
}

export function evaluateCustomRoles(
  entitlements: SocialEntitlements,
): EntitlementGateDecision {
  if (!entitlements.customRoles) {
    return {
      allowed: false,
      message: "Custom roles are included on Advanced plans.",
    };
  }

  return { allowed: true };
}

export function evaluateApprovals(
  entitlements: SocialEntitlements,
): EntitlementGateDecision {
  if (!entitlements.approvals) {
    return {
      allowed: false,
      message: "Approvals are included on Advanced plans.",
    };
  }

  return { allowed: true };
}

export function evaluateApiAccess(
  entitlements: SocialEntitlements,
): EntitlementGateDecision {
  if (!entitlements.apiAccess) {
    return {
      allowed: false,
      message: "API access is included on Advanced plans.",
    };
  }

  return { allowed: true };
}

export function evaluateReports(
  entitlements: SocialEntitlements,
): EntitlementGateDecision {
  if (!entitlements.reports) {
    return {
      allowed: false,
      message: "Reports are included on Starter and Advanced plans.",
    };
  }

  return { allowed: true };
}
