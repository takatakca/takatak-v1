import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { getIdentityHockeyFeatures } from "@/lib/hockey/delivery/entitlement";
import { ServiceError } from "@/lib/services/service-error";

export const HOCKEY_FAMILY_RSVP_STATUSES = [
  "going",
  "not_going",
  "unsure",
] as const;

export type HockeyFamilyRsvpStatus =
  (typeof HOCKEY_FAMILY_RSVP_STATUSES)[number];

async function context(authUserId: string, familyId: string) {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "Family RSVP is temporarily unavailable.");

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });
  if (!identity || (identity.accountStatus && identity.accountStatus !== "active")) {
    throw new ServiceError("forbidden", "An active TAKATAK identity is required.");
  }

  const guardian = await prisma.hockeyFamilyMember.findFirst({
    where: {
      familyId,
      linkedIdentityId: identity.id,
      memberType: "guardian",
      status: "active",
      family: { sourceApplication: HOCKEY_SOURCE_APPLICATION, status: "active" },
    },
    select: { family: { select: { ownerIdentityId: true } } },
  });
  if (!guardian) throw new ServiceError("forbidden", "You cannot manage that hockey family.");

  const features = await getIdentityHockeyFeatures(guardian.family.ownerIdentityId);
  if (!features.has("family_sync")) {
    throw new ServiceError("forbidden", "Premium family sync is required.");
  }
  return { prisma, identity };
}

async function exactChildEvent(input: {
  familyId: string;
  childMemberId: string;
  teamEventId: string;
}) {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "Family RSVP is temporarily unavailable.");

  const event = await prisma.hockeyTeamEvent.findFirst({
    where: { id: input.teamEventId, sourceApplication: HOCKEY_SOURCE_APPLICATION },
    select: { id: true, teamId: true, title: true, startsAt: true, status: true },
  });
  if (!event) throw new ServiceError("not_found", "Hockey event was not found.");

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
    select: { id: true, memberCode: true, displayName: true },
  });
  if (!child) {
    throw new ServiceError("forbidden", "That child is not assigned to this event's exact team.");
  }
  return { event, child };
}

export async function saveHockeyFamilyEventRsvp(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
  childMemberId: string;
  status: HockeyFamilyRsvpStatus;
}) {
  if (!HOCKEY_FAMILY_RSVP_STATUSES.includes(input.status)) {
    throw new ServiceError("invalid_input", "Family RSVP status is invalid.");
  }
  const { prisma, identity } = await context(input.authUserId, input.familyId);
  const { event, child } = await exactChildEvent(input);

  if (event.status === "cancelled" && input.status === "going") {
    throw new ServiceError("conflict", "A cancelled event cannot be marked as going.");
  }

  const rsvp = await prisma.hockeyFamilyEventRsvp.upsert({
    where: {
      familyId_teamEventId_childMemberId: {
        familyId: input.familyId,
        teamEventId: input.teamEventId,
        childMemberId: input.childMemberId,
      },
    },
    update: { status: input.status, updatedByIdentityId: identity.id },
    create: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
      childMemberId: input.childMemberId,
      updatedByIdentityId: identity.id,
      status: input.status,
    },
    select: { id: true, status: true, createdAt: true, updatedAt: true },
  });

  return {
    id: rsvp.id,
    status: rsvp.status,
    child,
    event: { ...event, startsAt: event.startsAt.toISOString() },
    createdAt: rsvp.createdAt.toISOString(),
    updatedAt: rsvp.updatedAt.toISOString(),
  };
}

export async function listHockeyFamilyEventRsvps(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
}) {
  const { prisma } = await context(input.authUserId, input.familyId);
  const event = await prisma.hockeyTeamEvent.findFirst({
    where: { id: input.teamEventId, sourceApplication: HOCKEY_SOURCE_APPLICATION },
    select: { id: true, teamId: true, title: true, startsAt: true, status: true },
  });
  if (!event) throw new ServiceError("not_found", "Hockey event was not found.");

  const rows = await prisma.hockeyFamilyEventRsvp.findMany({
    where: { familyId: input.familyId, teamEventId: input.teamEventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, status: true, createdAt: true, updatedAt: true,
      child: { select: { id: true, memberCode: true, displayName: true } },
    },
  });

  return {
    event: { ...event, startsAt: event.startsAt.toISOString() },
    rsvps: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function deleteHockeyFamilyEventRsvp(input: {
  authUserId: string;
  familyId: string;
  teamEventId: string;
  childMemberId: string;
}) {
  const { prisma } = await context(input.authUserId, input.familyId);
  const result = await prisma.hockeyFamilyEventRsvp.deleteMany({
    where: {
      familyId: input.familyId,
      teamEventId: input.teamEventId,
      childMemberId: input.childMemberId,
    },
  });
  return { deleted: result.count === 1 };
}
