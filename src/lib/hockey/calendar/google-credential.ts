import "server-only";

import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  calendarConnectionAad,
  decryptHockeyGoogleTokenPayload,
  encryptHockeyGoogleTokenPayload,
} from "./crypto";
import { refreshHockeyGoogleToken } from "./google-token";

const REFRESH_SKEW_MS = 2 * 60 * 1000;

export type HockeyGoogleCalendarCredential = {
  connectionId: string;
  calendarId: string;
  accessToken: string;
};

export async function getHockeyGoogleCalendarCredential(input: {
  identityId: string;
  forceRefresh?: boolean;
  now?: Date;
}): Promise<HockeyGoogleCalendarCredential> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Calendar credentials are temporarily unavailable.");
  }

  const connection = await prisma.hockeyCalendarConnection.findUnique({
    where: {
      identityId_sourceApplication_provider: {
        identityId: input.identityId,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        provider: "google",
      },
    },
    select: {
      id: true,
      status: true,
      calendarId: true,
      tokenCiphertext: true,
      tokenIv: true,
      tokenAuthTag: true,
      tokenKeyVersion: true,
      accessTokenExpiresAt: true,
      scopes: true,
    },
  });

  if (
    !connection ||
    connection.status !== "connected" ||
    !connection.tokenCiphertext ||
    !connection.tokenIv ||
    !connection.tokenAuthTag
  ) {
    throw new ServiceError(
      "not_found",
      "Connect Google Calendar before enabling calendar sync.",
    );
  }

  const aad = calendarConnectionAad({
    identityId: input.identityId,
    connectionId: connection.id,
  });

  const payload = decryptHockeyGoogleTokenPayload(
    {
      ciphertext: connection.tokenCiphertext,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag,
      keyVersion: connection.tokenKeyVersion,
    },
    aad,
  );

  const now = input.now ?? new Date();
  const shouldRefresh =
    input.forceRefresh === true ||
    !connection.accessTokenExpiresAt ||
    connection.accessTokenExpiresAt.getTime() <= now.getTime() + REFRESH_SKEW_MS;

  if (!shouldRefresh) {
    return {
      connectionId: connection.id,
      calendarId: connection.calendarId,
      accessToken: payload.accessToken,
    };
  }

  if (!payload.refreshToken) {
    throw new ServiceError(
      "unavailable",
      "Google Calendar must be reconnected to restore offline access.",
    );
  }

  const refreshed = await refreshHockeyGoogleToken(payload.refreshToken);
  const encrypted = encryptHockeyGoogleTokenPayload(
    {
      accessToken: refreshed.accessToken,
      refreshToken: payload.refreshToken,
      tokenType: refreshed.tokenType ?? payload.tokenType,
      scopes: refreshed.scopes.length > 0 ? refreshed.scopes : payload.scopes,
      externalAccountId: payload.externalAccountId,
      issuedAt: now.toISOString(),
    },
    aad,
  );

  await prisma.hockeyCalendarConnection.update({
    where: { id: connection.id },
    data: {
      tokenCiphertext: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenKeyVersion: encrypted.keyVersion,
      accessTokenExpiresAt: refreshed.expiresAt,
      scopes: refreshed.scopes.length > 0 ? refreshed.scopes : connection.scopes,
      lastValidatedAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  return {
    connectionId: connection.id,
    calendarId: connection.calendarId,
    accessToken: refreshed.accessToken,
  };
}
