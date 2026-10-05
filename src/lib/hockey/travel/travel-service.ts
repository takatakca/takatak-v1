import "server-only";

import { randomUUID } from "node:crypto";

import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  decryptHockeyTravelOrigin,
  encryptHockeyTravelOrigin,
  hockeyTravelAad,
  isHockeyTravelEncryptionConfigured,
  type HockeyTravelOrigin,
} from "./travel-crypto";

export type HockeyTravelOriginInput = {
  latitude: number;
  longitude: number;
  label: string | null;
};

export function validateHockeyTravelOriginInput(value: unknown):
  | { success: true; data: HockeyTravelOriginInput }
  | {
      success: false;
      message: string;
      fieldErrors: Record<string, string>;
    } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      message: "Choose a departure location.",
      fieldErrors: { origin: "A departure location is required." },
    };
  }

  const input = value as Record<string, unknown>;
  const latitude = input.latitude;
  const longitude = input.longitude;
  const label =
    typeof input.label === "string" && input.label.trim()
      ? input.label.trim().slice(0, 80)
      : null;

  const fieldErrors: Record<string, string> = {};

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    fieldErrors.latitude = "Latitude must be between -90 and 90.";
  }

  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    fieldErrors.longitude = "Longitude must be between -180 and 180.";
  }

  if (
    input.label !== undefined &&
    input.label !== null &&
    typeof input.label !== "string"
  ) {
    fieldErrors.label = "Location label must be text.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      message: "Review the departure location.",
      fieldErrors,
    };
  }

  return {
    success: true,
    data: {
      latitude: latitude as number,
      longitude: longitude as number,
      label,
    },
  };
}

async function requireTravelIdentity(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "Smart departure is temporarily unavailable.",
    );
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: { id: true, accountStatus: true },
  });

  if (!identity) {
    throw new ServiceError(
      "forbidden",
      "Verify your TAKATAK identity before enabling smart departure.",
    );
  }
  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  return { prisma, identity };
}

async function requireTravelPremium(authUserId: string) {
  const membership = await getHockeyMembershipSnapshot(authUserId);
  if (!membership.features.includes("smart_departure")) {
    throw new ServiceError(
      "forbidden",
      "An active AHMV Parent Premium smart-departure entitlement is required.",
    );
  }
}

export async function saveHockeyTravelOrigin(
  authUserId: string,
  input: HockeyTravelOriginInput,
) {
  if (!isHockeyTravelEncryptionConfigured()) {
    throw new ServiceError(
      "unavailable",
      "Smart departure encryption is not configured.",
    );
  }

  await requireTravelPremium(authUserId);
  const { prisma, identity } = await requireTravelIdentity(authUserId);

  const existing = await prisma.hockeyTravelProfile.findUnique({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    select: { id: true },
  });

  const profileId = existing?.id ?? randomUUID();
  const encrypted = encryptHockeyTravelOrigin(
    {
      latitude: input.latitude,
      longitude: input.longitude,
    },
    hockeyTravelAad({
      identityId: identity.id,
      profileId,
    }),
  );
  const now = new Date();

  const profile = await prisma.hockeyTravelProfile.upsert({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    update: {
      status: "active",
      originLabel: input.label,
      originCiphertext: encrypted.ciphertext,
      originIv: encrypted.iv,
      originAuthTag: encrypted.authTag,
      originKeyVersion: encrypted.keyVersion,
      departureConsentAt: now,
    },
    create: {
      id: profileId,
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
      status: "active",
      originLabel: input.label,
      originCiphertext: encrypted.ciphertext,
      originIv: encrypted.iv,
      originAuthTag: encrypted.authTag,
      originKeyVersion: encrypted.keyVersion,
      departureConsentAt: now,
    },
    select: {
      status: true,
      originLabel: true,
      departureConsentAt: true,
      updatedAt: true,
    },
  });

  return {
    ...profile,
    departureConsentAt: profile.departureConsentAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function getHockeyTravelOriginSummary(authUserId: string) {
  const { prisma, identity } = await requireTravelIdentity(authUserId);

  const profile = await prisma.hockeyTravelProfile.findUnique({
    where: {
      identityId_sourceApplication: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    select: {
      status: true,
      originLabel: true,
      departureConsentAt: true,
      lastUsedAt: true,
      updatedAt: true,
    },
  });

  return profile
    ? {
        configured: profile.status === "active",
        status: profile.status,
        originLabel: profile.originLabel,
        departureConsentAt: profile.departureConsentAt.toISOString(),
        lastUsedAt: profile.lastUsedAt?.toISOString() ?? null,
        updatedAt: profile.updatedAt.toISOString(),
      }
    : {
        configured: false,
        status: "not_configured",
        originLabel: null,
        departureConsentAt: null,
        lastUsedAt: null,
        updatedAt: null,
      };
}

export async function deleteHockeyTravelOrigin(authUserId: string) {
  const { prisma, identity } = await requireTravelIdentity(authUserId);

  const result = await prisma.hockeyTravelProfile.deleteMany({
    where: {
      identityId: identity.id,
      sourceApplication: HOCKEY_SOURCE_APPLICATION,
    },
  });

  const now = new Date();
  await prisma.hockeyDeliveryJob.updateMany({
    where: {
      identityId: identity.id,
      kind: "departure_alert",
      status: "queued",
    },
    data: {
      status: "skipped",
      completedAt: now,
      lastErrorCode: "travel_origin_removed",
      lastErrorMessage: "The parent removed the smart-departure origin.",
    },
  });

  return { deleted: result.count > 0 };
}

export async function loadHockeyTravelOriginForWorker(
  identityId: string,
): Promise<{
  profileId: string;
  origin: HockeyTravelOrigin;
  label: string | null;
} | null> {
  const prisma = getPrisma();
  if (!prisma) return null;

  const profile = await prisma.hockeyTravelProfile.findUnique({
    where: {
      identityId_sourceApplication: {
        identityId,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
      },
    },
    select: {
      id: true,
      status: true,
      originLabel: true,
      originCiphertext: true,
      originIv: true,
      originAuthTag: true,
      originKeyVersion: true,
      departureConsentAt: true,
    },
  });

  if (!profile || profile.status !== "active" || !profile.departureConsentAt) {
    return null;
  }

  const origin = decryptHockeyTravelOrigin(
    {
      ciphertext: profile.originCiphertext,
      iv: profile.originIv,
      authTag: profile.originAuthTag,
      keyVersion: profile.originKeyVersion,
    },
    hockeyTravelAad({
      identityId,
      profileId: profile.id,
    }),
  );

  return {
    profileId: profile.id,
    origin,
    label: profile.originLabel,
  };
}
