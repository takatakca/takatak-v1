import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import type { HockeyTravelProfileInput } from "./travel-profile-policy";

async function requireIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Smart-departure settings are temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });

  if (!identity) {
    throw new ServiceError("forbidden", "Verify your TAKATAK identity first.");
  }
  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

export async function getHockeyTravelProfile(authUserId: string) {
  const { prisma, identity } = await requireIdentity(authUserId);
  const profile = await prisma.hockeyTravelProfile.findUnique({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    select: {
      originLabel: true,
      originAddress: true,
      provider: true,
      consentAt: true,
      updatedAt: true,
    },
  });

  return profile
    ? {
        ...profile,
        consentAt: profile.consentAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      }
    : null;
}

export async function saveHockeyTravelProfile(
  authUserId: string,
  input: HockeyTravelProfileInput,
) {
  const { prisma, identity } = await requireIdentity(authUserId);
  const now = new Date();

  const profile = await prisma.hockeyTravelProfile.upsert({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    update: {
      provider: "google_routes",
      originLabel: input.originLabel,
      originAddress: input.originAddress,
      consentAt: now,
    },
    create: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      provider: "google_routes",
      originLabel: input.originLabel,
      originAddress: input.originAddress,
      consentAt: now,
    },
    select: {
      originLabel: true,
      originAddress: true,
      provider: true,
      consentAt: true,
      updatedAt: true,
    },
  });

  return {
    ...profile,
    consentAt: profile.consentAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function clearHockeyTravelProfile(authUserId: string) {
  const { prisma, identity } = await requireIdentity(authUserId);
  const now = new Date();

  await prisma.$transaction([
    prisma.hockeyTravelProfile.deleteMany({
      where: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    }),
    prisma.hockeyParentTeamPreference.updateMany({
      where: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        departureAlerts: true,
      },
      data: {
        departureAlerts: false,
        departureConsentAt: null,
      },
    }),
    prisma.hockeyDeliveryJob.updateMany({
      where: {
        identityId: identity.id,
        kind: "departure_alert",
        status: "queued",
      },
      data: {
        status: "skipped",
        completedAt: now,
        lastErrorCode: "travel_profile_cleared",
        lastErrorMessage: "The saved departure origin was removed.",
      },
    }),
  ]);

  return { cleared: true };
}
