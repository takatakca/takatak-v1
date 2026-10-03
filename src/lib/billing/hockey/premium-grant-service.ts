import "server-only";

import {
  SUPPORTER_GRANT_PLAN_CODE,
  SUPPORTER_GRANT_TYPE,
  SUPPORTER_THANK_YOU_WEEKS,
  isActiveSupporterGrant,
  shouldActivateSupporterGrantImmediately,
  supporterGrantExpiresAt,
} from "./premium-grant-policy";
import {
  HOCKEY_SOURCE_APPLICATION,
  resolveHockeyMembershipAccess,
} from "./membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export async function grantSupporterThankYou(input: {
  identityId: string;
  sourcePaymentId: string;
  now?: Date;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Premium grants are temporarily unavailable.");
  }

  const now = input.now ?? new Date();

  const existing = await prisma.hockeyPremiumGrant.findUnique({
    where: {
      sourceApplication_sourceReference: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        sourceReference: input.sourcePaymentId,
      },
    },
  });

  if (existing) {
    return { duplicate: true as const, grant: existing };
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { id: input.identityId },
    select: {
      id: true,
      accountStatus: true,
      hockeyMemberships: {
        where: { sourceApplication: HOCKEY_SOURCE_APPLICATION },
        take: 1,
        select: { status: true },
      },
      hockeyPremiumGrants: {
        where: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          status: "active",
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "desc" },
        take: 1,
        select: {
          status: true,
          activatedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!identity) {
    throw new ServiceError("not_found", "The TAKATAK identity was not found.");
  }
  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "The TAKATAK identity is not active.");
  }

  const paidMembershipAccess =
    resolveHockeyMembershipAccess(identity.hockeyMemberships[0]?.status ?? null) ===
    "paid";
  const hasActiveComplimentaryGrant = Boolean(
    identity.hockeyPremiumGrants[0] &&
      isActiveSupporterGrant(identity.hockeyPremiumGrants[0], now),
  );
  const activate = shouldActivateSupporterGrantImmediately({
    paidMembershipAccess,
    hasActiveComplimentaryGrant,
  });

  const grant = await prisma.hockeyPremiumGrant.create({
    data: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      grantType: SUPPORTER_GRANT_TYPE,
      sourceReference: input.sourcePaymentId,
      status: activate ? "active" : "available",
      planCode: SUPPORTER_GRANT_PLAN_CODE,
      grantedWeeks: SUPPORTER_THANK_YOU_WEEKS,
      activatedAt: activate ? now : null,
      expiresAt: activate
        ? supporterGrantExpiresAt(now, SUPPORTER_THANK_YOU_WEEKS)
        : null,
    },
  });

  return { duplicate: false as const, grant };
}

export async function redeemNextSupporterThankYou(
  authUserId: string,
  now = new Date(),
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Premium grants are temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      accountStatus: true,
      hockeyMemberships: {
        where: { sourceApplication: HOCKEY_SOURCE_APPLICATION },
        take: 1,
        select: { status: true },
      },
      hockeyPremiumGrants: {
        where: { sourceApplication: HOCKEY_SOURCE_APPLICATION },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          grantedWeeks: true,
          activatedAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!identity) {
    throw new ServiceError("forbidden", "Verify your TAKATAK identity first.");
  }
  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  const paid =
    resolveHockeyMembershipAccess(identity.hockeyMemberships[0]?.status ?? null) ===
    "paid";
  if (paid) {
    throw new ServiceError(
      "conflict",
      "Your thank-you credit is banked while the paid AHMV membership is active.",
    );
  }

  const active = identity.hockeyPremiumGrants.find((grant) =>
    isActiveSupporterGrant(grant, now),
  );
  if (active) {
    return { alreadyActive: true as const, grant: active };
  }

  const available = identity.hockeyPremiumGrants.find(
    (grant) => grant.status === "available" && !grant.revokedAt,
  );
  if (!available) {
    throw new ServiceError("not_found", "No AHMV thank-you credit is available.");
  }

  const grant = await prisma.hockeyPremiumGrant.update({
    where: { id: available.id },
    data: {
      status: "active",
      activatedAt: now,
      expiresAt: supporterGrantExpiresAt(now, available.grantedWeeks),
    },
  });

  return { alreadyActive: false as const, grant };
}
