import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family guardian access is temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      accountStatus: true,
    },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK identity before managing family access.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

export async function deactivateHockeyFamilyGuardian(input: {
  authUserId: string;
  familyId: string;
  guardianMemberId: string;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);

  const family = await prisma.hockeyFamily.findFirst({
    where: {
      id: input.familyId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "active",
    },
    select: {
      id: true,
      ownerIdentityId: true,
      members: {
        where: {
          memberType: "guardian",
          status: "active",
          linkedIdentityId: { not: null },
        },
        select: {
          id: true,
          linkedIdentityId: true,
        },
      },
    },
  });

  if (!family) {
    throw new ServiceError("not_found", "Hockey family was not found.");
  }

  const caller = family.members.find(
    (member) => member.linkedIdentityId === identity.id,
  );
  if (!caller) {
    throw new ServiceError(
      "forbidden",
      "This TAKATAK identity cannot manage that hockey family.",
    );
  }

  const target = family.members.find(
    (member) => member.id === input.guardianMemberId,
  );
  if (!target?.linkedIdentityId) {
    throw new ServiceError(
      "not_found",
      "Active family guardian was not found.",
    );
  }

  const targetIdentityId = target.linkedIdentityId;

  if (targetIdentityId === family.ownerIdentityId) {
    throw new ServiceError(
      "conflict",
      "The hockey family owner cannot be removed from the family.",
    );
  }

  const callerIsOwner = identity.id === family.ownerIdentityId;
  const callerIsTarget = identity.id === targetIdentityId;

  if (!callerIsOwner && !callerIsTarget) {
    throw new ServiceError(
      "forbidden",
      "Only the family owner can remove another guardian.",
    );
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const deactivated = await tx.hockeyFamilyMember.updateMany({
      where: {
        id: target.id,
        familyId: family.id,
        memberType: "guardian",
        status: "active",
        linkedIdentityId: targetIdentityId,
      },
      data: {
        status: "inactive",
      },
    });

    if (deactivated.count !== 1) {
      throw new ServiceError(
        "conflict",
        "Family guardian access has already changed.",
      );
    }

    const cancelledPlans = await tx.hockeyFamilyEventPlan.updateMany({
      where: {
        familyId: family.id,
        driverMemberId: target.id,
        status: { in: ["planned", "confirmed"] },
        teamEvent: {
          startsAt: { gt: now },
        },
      },
      data: {
        status: "cancelled",
      },
    });

    const revokedInvites = await tx.hockeyFamilyInvite.updateMany({
      where: {
        familyId: family.id,
        inviterIdentityId: targetIdentityId,
        status: "pending",
      },
      data: {
        status: "revoked",
        revokedAt: now,
      },
    });

    return {
      familyId: family.id,
      guardianMemberId: target.id,
      removedIdentityId: targetIdentityId,
      leftVoluntarily: callerIsTarget,
      cancelledFutureDrivingPlans: cancelledPlans.count,
      revokedPendingInvites: revokedInvites.count,
    };
  });
}
