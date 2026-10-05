import "server-only";

import { enabledPreferenceFeatures, type HockeyParentPreferenceInput } from "./parent-preference-policy";
import { HOCKEY_SOURCE_APPLICATION } from "./membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Parent hockey preferences are temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK identity before saving parent preferences.",
    );
  }

  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

export async function listHockeyParentTeamPreferences(authUserId: string) {
  const { prisma, identity } = await requireIdentity(authUserId);

  const rows = await prisma.hockeyParentTeamPreference.findMany({
    where: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
    },
    orderBy: [{ updatedAt: "desc" }, { teamId: "asc" }],
    select: {
      teamId: true,
      smsReminders: true,
      calendarSync: true,
      departureAlerts: true,
      arrivalBufferMinutes: true,
      smsConsentAt: true,
      calendarConsentAt: true,
      departureConsentAt: true,
      updatedAt: true,
    },
  });

  return rows.map((row) => ({
    ...row,
    smsConsentAt: row.smsConsentAt?.toISOString() ?? null,
    calendarConsentAt: row.calendarConsentAt?.toISOString() ?? null,
    departureConsentAt: row.departureConsentAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function saveHockeyParentTeamPreference(
  authUserId: string,
  input: HockeyParentPreferenceInput,
) {
  const { prisma, identity } = await requireIdentity(authUserId);
  const key = {
    identityId_sourceApplication_teamId: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      teamId: input.teamId,
    },
  };

  const existing = await prisma.hockeyParentTeamPreference.findUnique({
    where: key,
    select: {
      id: true,
      smsConsentAt: true,
      calendarConsentAt: true,
      departureConsentAt: true,
    },
  });

  const mustVerifyPublicTeam =
    !existing || enabledPreferenceFeatures(input).length > 0;

  if (mustVerifyPublicTeam) {
    const publicTeam = await prisma.hockeyPublicTeam.findUnique({
      where: {
        sourceApplication_teamId: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          teamId: input.teamId,
        },
      },
      select: {
        active: true,
      },
    });

    if (!publicTeam?.active) {
      throw new ServiceError(
        "not_found",
        "The exact public AHMV team ID is not active in the verified team directory.",
      );
    }
  }

  const now = new Date();

  const row = await prisma.hockeyParentTeamPreference.upsert({
    where: key,
    update: {
      smsReminders: input.smsReminders,
      calendarSync: input.calendarSync,
      departureAlerts: input.departureAlerts,
      arrivalBufferMinutes: input.arrivalBufferMinutes,
      smsConsentAt: input.smsReminders
        ? existing?.smsConsentAt ?? now
        : null,
      calendarConsentAt: input.calendarSync
        ? existing?.calendarConsentAt ?? now
        : null,
      departureConsentAt: input.departureAlerts
        ? existing?.departureConsentAt ?? now
        : null,
    },
    create: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      teamId: input.teamId,
      smsReminders: input.smsReminders,
      calendarSync: input.calendarSync,
      departureAlerts: input.departureAlerts,
      arrivalBufferMinutes: input.arrivalBufferMinutes,
      smsConsentAt: input.smsReminders ? now : null,
      calendarConsentAt: input.calendarSync ? now : null,
      departureConsentAt: input.departureAlerts ? now : null,
    },
    select: {
      teamId: true,
      smsReminders: true,
      calendarSync: true,
      departureAlerts: true,
      arrivalBufferMinutes: true,
      smsConsentAt: true,
      calendarConsentAt: true,
      departureConsentAt: true,
      updatedAt: true,
    },
  });

  return {
    ...row,
    smsConsentAt: row.smsConsentAt?.toISOString() ?? null,
    calendarConsentAt: row.calendarConsentAt?.toISOString() ?? null,
    departureConsentAt: row.departureConsentAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
