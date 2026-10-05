import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityHockeyFeatures } from "@/lib/hockey/delivery/entitlement";
import { ServiceError } from "@/lib/services/service-error";

export const HOCKEY_FAMILY_PLAN_STATUSES = [
  "planned",
  "confirmed",
  "cancelled",
] as const;

export type HockeyFamilyPlanStatus =
  (typeof HOCKEY_FAMILY_PLAN_STATUSES)[number];

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family game coordination is temporarily unavailable.",
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
      "Verify your TAKATAK identity before coordinating family game logistics.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

async function requireFamilyAccessAndFeature(input: {
  identityId: string;
  familyId: string;
  feature: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family game coordination is temporarily unavailable.",
    );
  }

  const guardian = await prisma.hockeyFamilyMember.findFirst({
    where: {
      familyId: input.familyId,
      linkedIdentityId: input.identityId,
      memberType: "guardian",
      status: "active",
      family: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        status: "active",
      },
    },
    select: {
      id: true,
      family: {
        select: {
          id: true,
          ownerIdentityId: true,
        },
      },
    },
  });

  if (!guardian) {
    throw new ServiceError(
      "forbidden",
      "This TAKATAK identity cannot coordinate that hockey family.",
    );
  }

  const ownerFeatures = await getIdentityHockeyFeatures(
    guardian.family.ownerIdentityId,
  );

  if (!ownerFeatures.has(input.feature)) {
    throw new ServiceError(
      "forbidden",
      "This hockey family does not currently include the required Premium coordination feature.",
    );
  }

  return guardian;
}

async function requireEventAndMembers(input: {
  familyId: string;
  teamEventId: string;
  childMemberId: string;
  driverMemberId: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family game coordination is temporarily unavailable.",
    );
  }

  const event = await prisma.hockeyTeamEvent.findFirst({
    where: {
      id: input.teamEventId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
    },
    select: {
      id: true,
      teamId: true,
      title: true,
      startsAt: true,
      status: true,
    },
  });

  if (!event) {
    throw new ServiceError("not_found", "Hockey event was not found.");
  }

  const child = await prisma.hockeyFamilyMember.findFirst({
    where: {
      id: input.childMemberId,
      familyId: input.familyId,
      memberType: "child",
      status: "active",
      selections: {
        some: {
          selectionType: "assigned",
          publicTeam: {
            sourceApplication: HOCKEY_SOURCE_APPLICATION,
            teamId: event.teamId,
            active: true,
          },
        },
      },
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  if (!child) {
    throw new ServiceError(
      "forbidden",
      "That child is not assigned to the exact team for this event.",
    );
  }

  const driver = await prisma.hockeyFamilyMember.findFirst({
    where: {
      id: input.driverMemberId,
      familyId: input.familyId,
      memberType: "guardian",
      status: "active",
      linkedIdentityId: { not: null },
    },
    select: {
      id: true,
      displayName: true,
      linkedIdentityId: true,
    },
  });

  if (!driver || !driver.linkedIdentityId) {
    throw new ServiceError(
      "forbidden",
      "The selected driver must be an authenticated guardian in this hockey family.",
    );
  }

  return { event, child, driver };
}

export async function saveHockeyFamilyEventPlan(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
  childMemberId: string;
  driverMemberId: string;
  status: HockeyFamilyPlanStatus;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);

  await requireFamilyAccessAndFeature({
    identityId: identity.id,
    familyId: input.familyId,
    feature: "parent_rideshare",
  });

  if (!HOCKEY_FAMILY_PLAN_STATUSES.includes(input.status)) {
    throw new ServiceError(
      "invalid_input",
      "Family game responsibility status is invalid.",
    );
  }

  const { event, child, driver } = await requireEventAndMembers(input);

  if (event.status === "cancelled" && input.status !== "cancelled") {
    throw new ServiceError(
      "conflict",
      "A cancelled hockey event cannot receive an active driving plan.",
    );
  }

  const plan = await prisma.hockeyFamilyEventPlan.upsert({
    where: {
      familyId_teamEventId_childMemberId: {
        familyId: input.familyId,
        teamEventId: input.teamEventId,
        childMemberId: input.childMemberId,
      },
    },
    update: {
      driverMemberId: input.driverMemberId,
      status: input.status,
      createdByIdentityId: identity.id,
    },
    create: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
      childMemberId: input.childMemberId,
      driverMemberId: input.driverMemberId,
      createdByIdentityId: identity.id,
      status: input.status,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    id: plan.id,
    status: plan.status,
    event: {
      id: event.id,
      teamId: event.teamId,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
    },
    child,
    driver: {
      id: driver.id,
      displayName: driver.displayName,
    },
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export async function listHockeyFamilyEventPlans(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);

  await requireFamilyAccessAndFeature({
    identityId: identity.id,
    familyId: input.familyId,
    feature: "parent_rideshare",
  });

  const event = await prisma.hockeyTeamEvent.findFirst({
    where: {
      id: input.teamEventId,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
    },
    select: {
      id: true,
      teamId: true,
      title: true,
      startsAt: true,
      status: true,
    },
  });

  if (!event) {
    throw new ServiceError("not_found", "Hockey event was not found.");
  }

  const plans = await prisma.hockeyFamilyEventPlan.findMany({
    where: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      child: {
        select: {
          id: true,
          memberCode: true,
          displayName: true,
        },
      },
      driver: {
        select: {
          id: true,
          memberCode: true,
          displayName: true,
        },
      },
    },
  });

  return {
    event: {
      id: event.id,
      teamId: event.teamId,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      status: event.status,
    },
    plans: plans.map((plan) => ({
      id: plan.id,
      status: plan.status,
      child: plan.child,
      driver: plan.driver,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    })),
  };
}

export async function deleteHockeyFamilyEventPlan(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
  childMemberId: string;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);

  await requireFamilyAccessAndFeature({
    identityId: identity.id,
    familyId: input.familyId,
    feature: "parent_rideshare",
  });

  const result = await prisma.hockeyFamilyEventPlan.deleteMany({
    where: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
      childMemberId: input.childMemberId,
    },
  });

  return { deleted: result.count === 1 };
}
