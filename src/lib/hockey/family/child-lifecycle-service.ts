import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

async function requireFamilyOwner(authUserId: string, familyId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family child management is temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK identity before managing child profiles.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  const family = await prisma.hockeyFamily.findFirst({
    where: {
      id: familyId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "active",
      ownerIdentityId: identity.id,
    },
    select: { id: true, ownerIdentityId: true },
  });

  if (!family) {
    throw new ServiceError(
      "forbidden",
      "Only the hockey family owner can manage child profiles.",
    );
  }

  return { prisma, identity, family };
}

function cleanDisplayName(value: string): string {
  const name = value.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) {
    throw new ServiceError("invalid_input", "Child display name is required.");
  }
  return name;
}

export async function updateHockeyFamilyChild(input: {
  authUserId: string;
  familyId: string;
  childMemberId: string;
  displayName?: string;
  status?: "active" | "inactive";
}) {
  const { prisma } = await requireFamilyOwner(
    input.authUserId,
    input.familyId,
  );

  if (input.displayName === undefined && input.status === undefined) {
    throw new ServiceError(
      "invalid_input",
      "Choose a child profile field to update.",
    );
  }

  const child = await prisma.hockeyFamilyMember.findFirst({
    where: {
      id: input.childMemberId,
      familyId: input.familyId,
      memberType: "child",
    },
    select: {
      id: true,
      memberCode: true,
      displayName: true,
      status: true,
    },
  });

  if (!child) {
    throw new ServiceError("not_found", "Child hockey profile was not found.");
  }

  const nextDisplayName =
    input.displayName === undefined
      ? child.displayName
      : cleanDisplayName(input.displayName);
  const nextStatus = input.status ?? child.status;

  if (nextStatus !== "active" && nextStatus !== "inactive") {
    throw new ServiceError("invalid_input", "Child profile status is invalid.");
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.hockeyFamilyMember.update({
      where: { id: child.id },
      data: {
        displayName: nextDisplayName,
        status: nextStatus,
      },
      select: {
        id: true,
        memberCode: true,
        memberType: true,
        displayName: true,
        status: true,
        updatedAt: true,
      },
    });

    let cancelledFutureDrivingPlans = 0;
    let removedFutureRsvps = 0;

    if (child.status !== "inactive" && nextStatus === "inactive") {
      const plans = await tx.hockeyFamilyEventPlan.updateMany({
        where: {
          familyId: input.familyId,
          childMemberId: child.id,
          status: { in: ["planned", "confirmed"] },
          teamEvent: {
            startsAt: { gt: now },
          },
        },
        data: {
          status: "cancelled",
        },
      });
      cancelledFutureDrivingPlans = plans.count;

      const rsvps = await tx.hockeyFamilyEventRsvp.deleteMany({
        where: {
          familyId: input.familyId,
          childMemberId: child.id,
          teamEvent: {
            startsAt: { gt: now },
          },
        },
      });
      removedFutureRsvps = rsvps.count;
    }

    return {
      child: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
      cancelledFutureDrivingPlans,
      removedFutureRsvps,
    };
  });
}

export async function deactivateHockeyFamilyChild(input: {
  authUserId: string;
  familyId: string;
  childMemberId: string;
}) {
  return updateHockeyFamilyChild({
    ...input,
    status: "inactive",
  });
}
