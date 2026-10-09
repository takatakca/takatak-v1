import "server-only";

import { randomUUID } from "node:crypto";

import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import { HOCKEY_SOURCE_APPLICATION } from "@/lib/billing/hockey/membership-policy";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  calendarConnectionAad,
  calendarOAuthStateAad,
  createHockeyOAuthState,
  createHockeyPkceChallenge,
  createHockeyPkceVerifier,
  decryptHockeyGoogleTokenPayload,
  decryptHockeyValue,
  encryptHockeyGoogleTokenPayload,
  encryptHockeyValue,
  hashHockeyOAuthState,
  isHockeyTokenEncryptionConfigured,
  verifyHockeyOAuthState,
} from "./crypto";
import {
  buildHockeyGoogleAuthorizationUrl,
  isHockeyGoogleCalendarEnabled,
} from "./google-config";
import { exchangeHockeyGoogleCode } from "./google-token";
import { queueHockeyCalendarBackfill } from "./calendar-backfill";

const OAUTH_TTL_MS = 10 * 60 * 1000;
const RETURN_PATH = "/dashboard?service=ahmv-membership&calendar=1";

function safeReturnPath(value: string | null | undefined): string {
  if (
    value &&
    value.startsWith("/dashboard") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes("://")
  ) {
    return value;
  }
  return RETURN_PATH;
}

function appendResult(
  path: string,
  result: "connected" | "cancelled" | "failed" | "expired",
): string {
  const url = new URL(path, "https://takatak.local");
  url.searchParams.set("calendar_oauth", result);
  return `${url.pathname}${url.search}${url.hash}`;
}

async function requireCalendarPremium(authUserId: string) {
  const snapshot = await getHockeyMembershipSnapshot(authUserId);
  if (!snapshot.features.includes("calendar_sync")) {
    throw new ServiceError(
      "forbidden",
      "An active AHMV Parent Premium entitlement is required for calendar sync.",
    );
  }
}

export async function startHockeyGoogleCalendarOAuth(input: {
  authUserId: string;
  returnPath?: string | null;
}): Promise<{ url: string }> {
  if (!isHockeyGoogleCalendarEnabled() || !isHockeyTokenEncryptionConfigured()) {
    throw new ServiceError(
      "unavailable",
      "Google Calendar connection is not configured.",
    );
  }

  await requireCalendarPremium(input.authUserId);

  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Calendar connection is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId: input.authUserId },
    select: { id: true, accountStatus: true },
  });

  if (!identity) {
    throw new ServiceError("forbidden", "Verify your TAKATAK identity first.");
  }
  if (identity.accountStatus && identity.accountStatus !== "active") {
    throw new ServiceError("forbidden", "This TAKATAK identity is not active.");
  }

  const state = createHockeyOAuthState();
  const verifier = createHockeyPkceVerifier();
  const stateId = randomUUID();
  const encryptedVerifier = encryptHockeyValue(
    verifier,
    calendarOAuthStateAad({ identityId: identity.id, stateId }),
  );
  const now = new Date();

  await prisma.$transaction([
    prisma.hockeyCalendarOAuthState.updateMany({
      where: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        provider: "google",
        status: "pending",
      },
      data: {
        status: "expired",
        consumedAt: now,
        errorMessage: "Superseded by a newer Google Calendar authorization request.",
      },
    }),
    prisma.hockeyCalendarOAuthState.create({
      data: {
        id: stateId,
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        provider: "google",
        stateHash: hashHockeyOAuthState(state),
        verifierCiphertext: encryptedVerifier.ciphertext,
        verifierIv: encryptedVerifier.iv,
        verifierAuthTag: encryptedVerifier.authTag,
        verifierKeyVersion: encryptedVerifier.keyVersion,
        status: "pending",
        returnPath: safeReturnPath(input.returnPath),
        expiresAt: new Date(now.getTime() + OAUTH_TTL_MS),
      },
    }),
  ]);

  return {
    url: buildHockeyGoogleAuthorizationUrl({
      state,
      codeChallenge: createHockeyPkceChallenge(verifier),
    }),
  };
}

export type HockeyCalendarCallbackResult = {
  returnPath: string;
  outcome: "connected" | "cancelled" | "failed" | "expired";
  message: string;
};

export async function completeHockeyGoogleCalendarOAuth(input: {
  authUserId: string | null;
  state: string | null;
  code: string | null;
  error: string | null;
}): Promise<HockeyCalendarCallbackResult> {
  const prisma = getPrisma();

  function fail(
    outcome: HockeyCalendarCallbackResult["outcome"],
    message: string,
    returnPath = RETURN_PATH,
  ): HockeyCalendarCallbackResult {
    return {
      outcome,
      message,
      returnPath: appendResult(safeReturnPath(returnPath), outcome),
    };
  }

  if (!prisma || !input.state?.trim()) {
    return fail("failed", "Google Calendar authorization response was invalid.");
  }

  const stateValue = input.state.trim().slice(0, 512);
  const oauthState = await prisma.hockeyCalendarOAuthState.findUnique({
    where: { stateHash: hashHockeyOAuthState(stateValue) },
    select: {
      id: true,
      identityId: true,
      stateHash: true,
      status: true,
      returnPath: true,
      expiresAt: true,
      verifierCiphertext: true,
      verifierIv: true,
      verifierAuthTag: true,
      verifierKeyVersion: true,
      identity: {
        select: { authUserId: true, accountStatus: true },
      },
    },
  });

  if (!oauthState || !verifyHockeyOAuthState(stateValue, oauthState.stateHash)) {
    return fail("failed", "Google Calendar authorization state was invalid.");
  }

  const returnPath = oauthState.returnPath;

  if (oauthState.status === "completed") {
    return fail("connected", "Google Calendar is already connected.", returnPath);
  }
  if (oauthState.status !== "pending") {
    return fail(
      oauthState.status === "expired" ? "expired" : "failed",
      "This Google Calendar authorization request cannot be reused.",
      returnPath,
    );
  }

  const now = new Date();
  if (oauthState.expiresAt.getTime() <= now.getTime()) {
    await prisma.hockeyCalendarOAuthState.update({
      where: { id: oauthState.id },
      data: { status: "expired", consumedAt: now },
    });
    return fail("expired", "Google Calendar authorization expired.", returnPath);
  }

  if (
    !input.authUserId ||
    oauthState.identity.authUserId !== input.authUserId ||
    (oauthState.identity.accountStatus &&
      oauthState.identity.accountStatus !== "active")
  ) {
    return fail("failed", "Sign in with the same TAKATAK account to finish.", returnPath);
  }

  if (input.error) {
    await prisma.hockeyCalendarOAuthState.update({
      where: { id: oauthState.id },
      data: {
        status: input.error === "access_denied" ? "cancelled" : "failed",
        consumedAt: now,
        errorMessage: "Google Calendar authorization was not completed.",
      },
    });
    return fail(
      input.error === "access_denied" ? "cancelled" : "failed",
      input.error === "access_denied"
        ? "Google Calendar authorization was cancelled."
        : "Google Calendar authorization failed.",
      returnPath,
    );
  }

  if (!input.code?.trim()) {
    return fail("failed", "Google Calendar did not return an authorization code.", returnPath);
  }

  try {
    await requireCalendarPremium(input.authUserId);

    const claimed = await prisma.hockeyCalendarOAuthState.updateMany({
      where: { id: oauthState.id, status: "pending" },
      data: { status: "processing" },
    });

    if (claimed.count !== 1) {
      return fail("failed", "Google Calendar authorization is already being processed.", returnPath);
    }

    const verifier = decryptHockeyValue(
      {
        ciphertext: oauthState.verifierCiphertext,
        iv: oauthState.verifierIv,
        authTag: oauthState.verifierAuthTag,
        keyVersion: oauthState.verifierKeyVersion,
      },
      calendarOAuthStateAad({
        identityId: oauthState.identityId,
        stateId: oauthState.id,
      }),
    );

    const tokens = await exchangeHockeyGoogleCode({
      code: input.code.trim().slice(0, 2048),
      codeVerifier: verifier,
    });

    const existing = await prisma.hockeyCalendarConnection.findUnique({
      where: {
        identityId_sourceApplication_provider: {
          identityId: oauthState.identityId,
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          provider: "google",
        },
      },
      select: {
        id: true,
        tokenCiphertext: true,
        tokenIv: true,
        tokenAuthTag: true,
        tokenKeyVersion: true,
      },
    });

    const connectionId = existing?.id ?? randomUUID();
    let refreshToken = tokens.refreshToken;

    if (
      !refreshToken &&
      existing?.tokenCiphertext &&
      existing.tokenIv &&
      existing.tokenAuthTag
    ) {
      try {
        const previous = decryptHockeyGoogleTokenPayload(
          {
            ciphertext: existing.tokenCiphertext,
            iv: existing.tokenIv,
            authTag: existing.tokenAuthTag,
            keyVersion: existing.tokenKeyVersion,
          },
          calendarConnectionAad({
            identityId: oauthState.identityId,
            connectionId,
          }),
        );
        refreshToken = previous.refreshToken;
      } catch {
        // A reconnect with prompt=consent should normally return a new refresh token.
      }
    }

    if (!refreshToken) {
      throw new ServiceError(
        "unavailable",
        "Google did not return a refresh token. Reconnect and approve offline access.",
      );
    }

    const encrypted = encryptHockeyGoogleTokenPayload(
      {
        accessToken: tokens.accessToken,
        refreshToken,
        tokenType: tokens.tokenType,
        scopes: tokens.scopes,
        externalAccountId: tokens.externalAccountId,
        issuedAt: now.toISOString(),
      },
      calendarConnectionAad({
        identityId: oauthState.identityId,
        connectionId,
      }),
    );

    await prisma.$transaction([
      prisma.hockeyCalendarConnection.upsert({
        where: {
          identityId_sourceApplication_provider: {
            identityId: oauthState.identityId,
            sourceApplication: HOCKEY_SOURCE_APPLICATION,
            provider: "google",
          },
        },
        update: {
          status: "connected",
          externalAccountId: tokens.externalAccountId,
          displayName: tokens.displayName,
          scopes: tokens.scopes,
          tokenCiphertext: encrypted.ciphertext,
          tokenIv: encrypted.iv,
          tokenAuthTag: encrypted.authTag,
          tokenKeyVersion: encrypted.keyVersion,
          accessTokenExpiresAt: tokens.expiresAt,
          connectedAt: now,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
        create: {
          id: connectionId,
          identityId: oauthState.identityId,
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          provider: "google",
          status: "connected",
          externalAccountId: tokens.externalAccountId,
          displayName: tokens.displayName,
          scopes: tokens.scopes,
          tokenCiphertext: encrypted.ciphertext,
          tokenIv: encrypted.iv,
          tokenAuthTag: encrypted.authTag,
          tokenKeyVersion: encrypted.keyVersion,
          accessTokenExpiresAt: tokens.expiresAt,
          connectedAt: now,
          lastValidatedAt: now,
        },
      }),
      prisma.hockeyCalendarOAuthState.update({
        where: { id: oauthState.id },
        data: {
          status: "completed",
          consumedAt: now,
          errorMessage: null,
        },
      }),
    ]);

    await queueHockeyCalendarBackfill(oauthState.identityId, now);

    return fail("connected", "Google Calendar connected successfully.", returnPath);
  } catch (error) {
    await prisma.hockeyCalendarOAuthState.updateMany({
      where: { id: oauthState.id, status: "processing" },
      data: {
        status: "failed",
        consumedAt: new Date(),
        errorMessage:
          error instanceof ServiceError
            ? error.message.slice(0, 500)
            : "Google Calendar connection failed.",
      },
    });

    return fail(
      "failed",
      error instanceof ServiceError
        ? error.message
        : "Google Calendar connection failed.",
      returnPath,
    );
  }
}

export async function getHockeyGoogleCalendarStatus(authUserId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Calendar status is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      hockeyCalendarConnections: {
        where: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          provider: "google",
        },
        take: 1,
        select: {
          status: true,
          displayName: true,
          calendarId: true,
          connectedAt: true,
          lastValidatedAt: true,
        },
      },
    },
  });

  const connection = identity?.hockeyCalendarConnections[0] ?? null;
  return {
    connected: connection?.status === "connected",
    status: connection?.status ?? "not_connected",
    displayName: connection?.displayName ?? null,
    calendarId: connection?.calendarId ?? null,
    connectedAt: connection?.connectedAt?.toISOString() ?? null,
    lastValidatedAt: connection?.lastValidatedAt?.toISOString() ?? null,
  };
}


export async function disconnectHockeyGoogleCalendar(
  authUserId: string,
): Promise<{ disconnected: boolean }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "Calendar connection is temporarily unavailable.");
  }

  const identity = await prisma.masterIdentity.findUnique({
    where: { authUserId },
    select: {
      id: true,
      hockeyCalendarConnections: {
        where: {
          sourceApplication: HOCKEY_SOURCE_APPLICATION,
          provider: "google",
        },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!identity) {
    throw new ServiceError("forbidden", "Verify your TAKATAK identity first.");
  }

  const connection = identity.hockeyCalendarConnections[0] ?? null;
  if (!connection) {
    return { disconnected: false };
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.hockeyCalendarConnection.update({
      where: { id: connection.id },
      data: {
        status: "revoked",
        tokenCiphertext: null,
        tokenIv: null,
        tokenAuthTag: null,
        accessTokenExpiresAt: null,
        lastValidatedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    }),
    prisma.hockeyCalendarOAuthState.updateMany({
      where: {
        identityId: identity.id,
        sourceApplication: HOCKEY_SOURCE_APPLICATION,
        provider: "google",
        status: { in: ["pending", "processing"] },
      },
      data: {
        status: "cancelled",
        consumedAt: now,
        errorMessage: "Calendar connection was disconnected by the user.",
      },
    }),
    prisma.hockeyDeliveryJob.updateMany({
      where: {
        identityId: identity.id,
        kind: "calendar_sync",
        status: "queued",
      },
      data: {
        status: "skipped",
        completedAt: now,
        lastErrorCode: "calendar_disconnected",
        lastErrorMessage: "Google Calendar is disconnected.",
      },
    }),
  ]);

  return { disconnected: true };
}
