import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityHockeyFeatures } from "@/lib/hockey/delivery/entitlement";
import { ServiceError } from "@/lib/services/service-error";

export const HOCKEY_FAMILY_RSVP_RESPONSES = [
  "going",
  "maybe",
  "not_going",
] as const;

export type HockeyFamilyRsvpResponse =
  (typeof HOCKEY_FAMILY_RSVP_RESPONSES)[number];

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family event RSVP is temporarily unavailable.",
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
      "Verify your TAKATAK identity before managing family event responses.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

async function requireFamilyGuardianAndFeature(input: {
  identityId: string;
  familyId: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family event RSVP is temporarily unavailable.",
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
          ownerIdentityId: true,
        },
      },
    },
  });

  if (!guardian) {
    throw new ServiceError(
      "forbidden",
      "This TAKATAK identity cannot manage that hockey family's event responses.",
    );
  }

  const features = await getIdentityHockeyFeatures(
    guardian.family.ownerIdentityId,
  );
  if (!features.has("family_sync")) {
    throw new ServiceError(
      "forbidden",
      "This hockey family does not currently include Premium family sync.",
    );
  }

  return guardian;
}

async function requireExactChildEvent(input: {
  familyId: string;
  teamEventId: string;
  memberId: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Family event RSVP is temporarily unavailable.",
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
      id: input.memberId,
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
      memberCode: true,
      displayName: true,
    },
  });

  if (!child) {
    throw new ServiceError(
      "forbidden",
      "That child is not assigned to the exact team for this event.",
    );
  }

  return { event, child };
}

export async function saveHockeyFamilyEventRsvp(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
  memberId: string;
  response: HockeyFamilyRsvpResponse;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireFamilyGuardianAndFeature({
    identityId: identity.id,
    familyId: input.familyId,
  });

  if (!HOCKEY_FAMILY_RSVP_RESPONSES.includes(input.response)) {
    throw new ServiceError("invalid_input", "Family RSVP response is invalid.");
  }

  const { event, child } = await requireExactChildEvent(input);

  if (event.status === "cancelled" && input.response !== "not_going") {
    throw new ServiceError(
      "conflict",
      "A cancelled hockey event cannot be marked going or maybe.",
    );
  }

  const row = await prisma.hockeyFamilyEventResponse.upsert({
    where: {
      familyId_teamEventId_memberId: {
        familyId: input.familyId,
        teamEventId: input.teamEventId,
        memberId: input.memberId,
      },
    },
    update: {
      response: input.response,
      respondedByIdentityId: identity.id,
    },
    create: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
      memberId: input.memberId,
      respondedByIdentityId: identity.id,
      response: input.response,
    },
    select: {
      id: true,
      response: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    id: row.id,
    response: row.response,
    event: {
      id: event.id,
      teamId: event.teamId,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      status: event.status,
    },
    child,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listHockeyFamilyEventRsvps(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireFamilyGuardianAndFeature({
    identityId: identity.id,
    familyId: input.familyId,
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

  const responses = await prisma.hockeyFamilyEventResponse.findMany({
    where: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      response: true,
      createdAt: true,
      updatedAt: true,
      member: {
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
    responses: responses.map((row) => ({
      id: row.id,
      response: row.response,
      child: row.member,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function deleteHockeyFamilyEventRsvp(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
  memberId: string;
}) {
  const { prisma, identity } = await requireIdentity(input.authUserId);
  await requireFamilyGuardianAndFeature({
    identityId: identity.id,
    familyId: input.familyId,
  });

  const result = await prisma.hockeyFamilyEventResponse.deleteMany({
    where: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
      memberId: input.memberId,
      member: {
        familyId: input.familyId,
      },
    },
  });

  return { deleted: result.count === 1 };
}
