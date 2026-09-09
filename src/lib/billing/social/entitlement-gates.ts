import "server-only";

import type { PostStatus, Prisma } from "@prisma/client";

import {
  analyticsHistoryCutoffDate,
  clipAnalyticsDateRange,
  evaluateAddCompetitor,
  evaluateApiAccess,
  evaluateApprovals,
  evaluateCustomRoles,
  evaluateReports,
  evaluateSchedulePost,
  evaluateSocialNetworkConnect,
  evaluateTeamInvite,
  evaluateWorkspaceWriteAccess,
  SOCIAL_BILLABLE_POST_STATUSES,
  utcMonthBounds,
  type AnalyticsDateRange,
} from "@/lib/billing/social/entitlement-gates-policy";
import { resolveEffectiveSocialEntitlements } from "@/lib/billing/social/subscription-lifecycle";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

type SubscriptionDb =
  | Prisma.TransactionClient
  | {
      clientSubscription: Prisma.TransactionClient["clientSubscription"];
      socialAccount?: Prisma.TransactionClient["socialAccount"];
      socialPost?: Prisma.TransactionClient["socialPost"];
    };

const SUBSCRIPTION_SELECT = {
  status: true,
  planCode: true,
  cancelAtPeriodEnd: true,
  currentPeriodEnd: true,
  xAccountAllowance: true,
  advancedAnalytics: true,
} as const;

export async function loadClientSocialEntitlementContext(
  db: SubscriptionDb,
  clientId: string,
) {
  const subscription = await db.clientSubscription.findUnique({
    where: { clientId },
    select: SUBSCRIPTION_SELECT,
  });

  return resolveEffectiveSocialEntitlements({
    status: subscription?.status,
    planCode: subscription?.planCode,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
    currentPeriodEnd: subscription?.currentPeriodEnd,
    addOns: {
      xAccountAllowance: subscription?.xAccountAllowance ?? 0,
      advancedAnalytics: subscription?.advancedAnalytics ?? false,
    },
  });
}

async function requireEntitlementContext(clientId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Billing is temporarily unavailable.");
  }

  return loadClientSocialEntitlementContext(prisma, clientId);
}

function deny(decision: { allowed: false; message: string }): never {
  throw new ServiceError("forbidden", decision.message);
}

export async function countConnectedXAccounts(
  db: SubscriptionDb,
  clientId: string,
): Promise<number> {
  if (!db.socialAccount) {
    return 0;
  }

  return db.socialAccount.count({
    where: {
      clientId,
      platform: "x",
      status: {
        in: ["connected", "expired", "error", "pending_connection"],
      },
    },
  });
}

export async function countBillablePostsThisMonth(
  db: SubscriptionDb,
  clientId: string,
  now = new Date(),
): Promise<number> {
  if (!db.socialPost) {
    return 0;
  }

  const { start, end } = utcMonthBounds(now);
  return db.socialPost.count({
    where: {
      clientId,
      status: {
        in: [...SOCIAL_BILLABLE_POST_STATUSES] as PostStatus[],
      },
      createdAt: { gte: start, lt: end },
    },
  });
}

export async function assertClientCanConnectSocialNetwork(
  db: SubscriptionDb,
  clientId: string,
  provider: string,
  options?: { reconnect?: boolean },
): Promise<void> {
  const { entitlements } = await loadClientSocialEntitlementContext(
    db,
    clientId,
  );
  const connectedXCount = await countConnectedXAccounts(db, clientId);
  const decision = evaluateSocialNetworkConnect({
    provider,
    entitlements,
    connectedXCount,
    reconnect: options?.reconnect,
  });

  if (!decision.allowed) {
    deny(decision);
  }
}

export async function assertClientCanScheduleSocialPost(
  clientId: string,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Publishing is temporarily unavailable.");
  }

  const { lifecycle, entitlements } =
    await loadClientSocialEntitlementContext(prisma, clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const usedThisMonth = await countBillablePostsThisMonth(prisma, clientId);
  const decision = evaluateSchedulePost({ entitlements, usedThisMonth });
  if (!decision.allowed) {
    deny(decision);
  }
}

export async function clipAnalyticsDateRangeForClient(
  clientId: string,
  range: AnalyticsDateRange,
): Promise<AnalyticsDateRange> {
  const { entitlements } = await requireEntitlementContext(clientId);
  const clipped = clipAnalyticsDateRange(
    range,
    entitlements.analyticsHistoryDays,
  );
  return {
    start: clipped.start,
    end: clipped.end,
    compareStart: clipped.compareStart,
    compareEnd: clipped.compareEnd,
  };
}

export async function analyticsHistoryCutoffForClient(
  clientId: string,
): Promise<Date | null> {
  const { entitlements } = await requireEntitlementContext(clientId);
  const cutoff = analyticsHistoryCutoffDate(entitlements.analyticsHistoryDays);
  return cutoff ? new Date(`${cutoff}T00:00:00.000Z`) : null;
}

export async function assertClientCanAddCompetitor(
  clientId: string,
  activeCount: number,
): Promise<void> {
  const { lifecycle, entitlements } = await requireEntitlementContext(clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const decision = evaluateAddCompetitor({ entitlements, activeCount });
  if (!decision.allowed) {
    deny(decision);
  }
}

export async function assertClientCanInviteTeam(
  clientId: string,
): Promise<void> {
  const { lifecycle, entitlements } = await requireEntitlementContext(clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const decision = evaluateTeamInvite(entitlements);
  if (!decision.allowed) {
    deny(decision);
  }
}

export async function assertClientCanManageCustomRoles(
  clientId: string,
): Promise<void> {
  const { lifecycle, entitlements } = await requireEntitlementContext(clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const decision = evaluateCustomRoles(entitlements);
  if (!decision.allowed) {
    deny(decision);
  }
}

export async function assertClientCanUseApprovals(
  clientId: string,
): Promise<void> {
  const { lifecycle, entitlements } = await requireEntitlementContext(clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const decision = evaluateApprovals(entitlements);
  if (!decision.allowed) {
    deny(decision);
  }
}

export async function assertClientCanUseSocialApi(
  clientId: string,
): Promise<void> {
  const { lifecycle, entitlements } = await requireEntitlementContext(clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const decision = evaluateApiAccess(entitlements);
  if (!decision.allowed) {
    deny(decision);
  }
}

export async function assertClientCanUseReports(
  clientId: string,
): Promise<void> {
  const { lifecycle, entitlements } = await requireEntitlementContext(clientId);
  const write = evaluateWorkspaceWriteAccess(lifecycle.access);
  if (!write.allowed) {
    deny(write);
  }

  const decision = evaluateReports(entitlements);
  if (!decision.allowed) {
    deny(decision);
  }
}
