import "server-only";

import { randomUUID } from "node:crypto";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export type HockeyFamilySelectionType = "assigned" | "favorite";

function memberCode() {
  return `HM-${randomUUID()}`;
}

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family hockey services are temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      accountStatus: true,
    },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK identity before managing family hockey.",
    );
  }
  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

async function requireGuardianFamilyAccess(
  identityId: string,
  familyId: string,
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Family hockey services are unavailable.");
  }

  const access = await prisma.hockeyFamilyMember.findFirst({
    where: {
      familyId,
      linkedIdentityId: identityId,
      memberType: "guardian",
      status: "active",
      family: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        status: "active",
      },
    },
    select: {
      id: true,
      familyId: true,
    },
  });

  if (!access) {
    throw new ServiceError(
      "forbidden",
      "This TAKATAK identity does not have access to that hockey family.",
    );
  }

  return access;
}

export async function ensureDefaultHockeyFamily(authUserId: string) {
  const { prisma, identity } = await requireIdentity(authUserId);
  const displayName =
    [identity.firstName, identity.lastName].filter(Boolean).join(" ").trim() ||
    "Parent";

  const family = await prisma.hockeyFamily.upsert({
    where: {
      ownerIdentityId_sourceApplication: {
        ownerIdentityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    update: { status: "active" },
    create: {
      ownerIdentityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "active",
    },
    select: { id: true },
  });

  const guardian = await prisma.hockeyFamilyMember.upsert({
    where: {
      familyId_linkedIdentityId: {
        familyId: family.id,
        linkedIdentityId: identity.id,
      },
    },
    update: {
      memberType: "guardian",
      displayName,
      status: "active",
    },
    create: {
      familyId: family.id,
      linkedIdentityId: identity.id,
      memberCode: memberCode(),
      memberType: "guardian",
      displayName,
      status: "active",
    },
    select: {
      id: true,
      memberCode: true,
      displayName: true,
    },
  });

  return {
    familyId: family.id,
    guardian,
  };
}

export async function listAccessibleHockeyFamilies(authUserId: string) {
  const { prisma, identity } = await requireIdentity(authUserId);

  const families = await prisma.hockeyFamily.findMany({
    where: {
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "active",
      members: {
        some: {
          linkedIdentityId: identity.id,
          memberType: "guardian",
          status: "active",
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      ownerIdentityId: true,
      members: {
        where: { status: "active" },
        orderBy: [{ memberType: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          memberCode: true,
          memberType: true,
          displayName: true,
          linkedIdentityId: true,
          selections: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              selectionType: true,
              publicTeam: {
                select: {
                  teamId: true,
                  categorySlug: true,
                  level: true,
                  name: true,
                  seasonCode: true,
                  active: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return families.map((family) => ({
    id: family.id,
    displayName: family.displayName,
    isOwner: family.ownerIdentityId === identity.id,
    members: family.members.map((member) => ({
      id: member.id,
      memberCode: member.memberCode,
      memberType: member.memberType,
      displayName: member.displayName,
      linked: Boolean(member.linkedIdentityId),
      teams: member.selections.map((selection) => ({
        selectionId: selection.id,
        selectionType: selection.selectionType,
        ...selection.publicTeam,
      })),
    })),
  }));
}

export async function addHockeyFamilyChild(input: {
  authUserId: string;
  familyId: string;
  displayName: string;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianFamilyAccess(identity.id, input.familyId);

  const displayName = input.displayName.trim().slice(0, 80);
  if (!displayName) {
    throw new ServiceError("invalid_input", "Child display name is required.");
  }

  return prisma.hockeyFamilyMember.create({
    data: {
      familyId: input.familyId,
      memberCode: memberCode(),
      memberType: "child",
      displayName,
      status: "active",
    },
    select: {
      id: true,
      memberCode: true,
      memberType: true,
      displayName: true,
    },
  });
}

export async function addHockeyFamilyTeamSelection(input: {
  authUserId: string;
  familyId: string;
  memberId: string;
  teamId: string;
  selectionType: HockeyFamilySelectionType;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianFamilyAccess(identity.id, input.familyId);

  const member = await prisma.hockeyFamilyMember.findFirst({
    where: {
      id: input.memberId,
      familyId: input.familyId,
      status: "active",
    },
    select: {
      id: true,
      memberType: true,
    },
  });

  if (!member) {
    throw new ServiceError(
      "not_found",
      "That family member does not belong to this hockey family.",
    );
  }

  if (
    input.selectionType === "assigned" &&
    member.memberType !== "child"
  ) {
    throw new ServiceError(
      "invalid_input",
      "Assigned teams are reserved for child profiles. Use favorite for a guardian.",
    );
  }

  const exactTeam = await prisma.hockeyPublicTeam.findUnique({
    where: {
      sourceApplication_teamId: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        teamId: input.teamId,
      },
    },
    select: {
      id: true,
      teamId: true,
      categorySlug: true,
      level: true,
      name: true,
      seasonCode: true,
      active: true,
    },
  });

  if (!exactTeam || !exactTeam.active) {
    throw new ServiceError(
      "not_found",
      "The exact public AHMV team ID is not active in the verified team directory.",
    );
  }

  const selection = await prisma.hockeyFamilyTeamSelection.upsert({
    where: {
      memberId_publicTeamId_selectionType: {
        memberId: member.id,
        publicTeamId: exactTeam.id,
        selectionType: input.selectionType,
      },
    },
    update: {},
    create: {
      familyId: input.familyId,
      memberId: member.id,
      publicTeamId: exactTeam.id,
      selectionType: input.selectionType,
    },
    select: { id: true },
  });

  return {
    selectionId: selection.id,
    selectionType: input.selectionType,
    team: exactTeam,
  };
}

export async function removeHockeyFamilyTeamSelection(input: {
  authUserId: string;
  familyId: string;
  memberId: string;
  teamId: string;
  selectionType: HockeyFamilySelectionType;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianFamilyAccess(identity.id, input.familyId);

  const exactTeam = await prisma.hockeyPublicTeam.findUnique({
    where: {
      sourceApplication_teamId: {
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        teamId: input.teamId,
      },
    },
    select: { id: true },
  });

  if (!exactTeam) return { deleted: false };

  const result = await prisma.hockeyFamilyTeamSelection.deleteMany({
    where: {
      familyId: input.familyId,
      memberId: input.memberId,
      publicTeamId: exactTeam.id,
      selectionType: input.selectionType,
      member: {
        familyId: input.familyId,
      },
    },
  });

  return { deleted: result.count > 0 };
}

export async function getHockeyFamilySchedule(input: {
  authUserId: string;
  familyId: string;
  from: Date;
  to: Date;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireGuardianFamilyAccess(identity.id, input.familyId);

  const members = await prisma.hockeyFamilyMember.findMany({
    where: {
      familyId: input.familyId,
      status: "active",
    },
    orderBy: [{ memberType: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      memberCode: true,
      memberType: true,
      displayName: true,
      selections: {
        select: {
          selectionType: true,
          publicTeam: {
            select: {
              teamId: true,
              name: true,
              level: true,
              categorySlug: true,
              active: true,
            },
          },
        },
      },
    },
  });

  const allTeamIds = [
    ...new Set(
      members.flatMap((member) =>
        member.selections
          .filter((selection) => selection.publicTeam.active)
          .map((selection) => selection.publicTeam.teamId),
      ),
    ),
  ];

  const events =
    allTeamIds.length === 0
      ? []
      : await prisma.hockeyTeamEvent.findMany({
          where: {
            sourceApplication: HOCKEY_SOURCE_APPLICATION,
            teamId: { in: allTeamIds },
            startsAt: {
              gte: input.from,
              lte: input.to,
            },
          },
          orderBy: [{ startsAt: "asc" }, { teamId: "asc" }],
          select: {
            id: true,
            sourceEventId: true,
            teamId: true,
            eventType: true,
            title: true,
            startsAt: true,
            endsAt: true,
            timezone: true,
            arenaName: true,
            arenaAddress: true,
            status: true,
            sourceUrl: true,
            sourceUpdatedAt: true,
          },
        });

  const byTeam = new Map<string, typeof events>();
  for (const event of events) {
    const list = byTeam.get(event.teamId) ?? [];
    list.push(event);
    byTeam.set(event.teamId, list);
  }

  const projectedMembers = members.map((member) => {
    const exactIds = new Set(
      member.selections
        .filter((selection) => selection.publicTeam.active)
        .map((selection) => selection.publicTeam.teamId),
    );

    return {
      id: member.id,
      memberCode: member.memberCode,
      memberType: member.memberType,
      displayName: member.displayName,
      teams: member.selections.map((selection) => ({
        selectionType: selection.selectionType,
        ...selection.publicTeam,
      })),
      events: events.filter((event) => exactIds.has(event.teamId)),
    };
  });

  return {
    familyId: input.familyId,
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    members: projectedMembers,
    allEvents: events,
  };
}
