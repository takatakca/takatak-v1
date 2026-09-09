import "server-only";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { persistDiscoveredYoutubeChannels } from "@/lib/social/connections/social-youtube-account-service";
import { completeSocialOAuthState } from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  exchangeGoogleCodeForStoredCredential,
  GoogleTokenConsumedError,
} from "@/lib/social/providers/google-token";
import { listYoutubeChannelsForAccessToken } from "@/lib/social/providers/google-youtube";
import {
  decryptSocialValue,
  hashOAuthState,
  verifyOAuthStateHash,
} from "@/lib/social/security/social-crypto";

const MAX_STATE_LENGTH = 512;
const MAX_CODE_LENGTH = 2048;
const MAX_ERROR_LENGTH = 128;
const MAX_ERROR_DESC_LENGTH = 256;

export type GoogleCallbackOutcome =
  | "accepted"
  | "cancelled"
  | "expired"
  | "failed";

export type GoogleCallbackResult = {
  outcome: GoogleCallbackOutcome;
  returnPath: string;
  message: string;
};

type CallbackInput = {
  code: string | null;
  state: string | null;
  error: string | null;
  errorReason: string | null;
  errorDescription: string | null;
};

function clamp(value: string | null, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function isSafeDashboardReturnPath(value: string): boolean {
  return (
    value.startsWith("/dashboard") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes("://")
  );
}

function sanitizeReturnPath(value: string | null | undefined): string {
  if (value && isSafeDashboardReturnPath(value)) {
    return value;
  }
  return "/dashboard/social?connections=open";
}

function appendOutcome(
  returnPath: string,
  outcome: GoogleCallbackOutcome,
): string {
  const url = new URL(returnPath, "http://takatak.local");
  url.searchParams.set("social_oauth", outcome);
  return `${url.pathname}${url.search}${url.hash}`;
}

function readKeyVersion(metadata: unknown): number {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return 1;
  }
  const value = (metadata as Record<string, unknown>).keyVersion;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 1;
}

function parseCallbackInput(
  raw: Record<string, string | undefined>,
): CallbackInput {
  return {
    code: clamp(raw.code ?? null, MAX_CODE_LENGTH),
    state: clamp(raw.state ?? null, MAX_STATE_LENGTH),
    error: clamp(raw.error ?? null, MAX_ERROR_LENGTH),
    errorReason: clamp(raw.error_reason ?? null, MAX_ERROR_LENGTH),
    errorDescription: clamp(raw.error_description ?? null, MAX_ERROR_DESC_LENGTH),
  };
}

function isCancellation(input: CallbackInput): boolean {
  if (!input.error) return false;
  const blob = [input.error, input.errorReason, input.errorDescription]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    input.error === "access_denied" ||
    blob.includes("denied") ||
    blob.includes("cancel")
  );
}

function safeFailResult(
  outcome: GoogleCallbackOutcome,
  message: string,
  returnPath?: string,
): GoogleCallbackResult {
  return {
    outcome,
    returnPath: appendOutcome(sanitizeReturnPath(returnPath), outcome),
    message,
  };
}

async function markOAuthAttempt(options: {
  oauthStateId: string;
  connectionId: string | null;
  status: "cancelled" | "failed" | "expired";
  errorMessage: string;
  failConnection: boolean;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.socialOAuthState.updateMany({
      where: {
        id: options.oauthStateId,
        status: { in: ["pending", "processing"] },
      },
      data: {
        status: options.status,
        errorMessage: options.errorMessage.slice(0, 500),
        consumedAt: now,
      },
    });

    if (options.failConnection && options.connectionId) {
      await tx.socialProviderConnection.updateMany({
        where: {
          id: options.connectionId,
          status: { in: ["pending_authorization", "authorized"] },
        },
        data: {
          status: "failed",
          lastErrorCode: options.status.slice(0, 64),
          lastErrorMessage: options.errorMessage.slice(0, 500),
          lastErrorAt: now,
        },
      });
    }
  });
}

export async function processGoogleOAuthCallback(options: {
  rawQuery: Record<string, string | undefined>;
  profileId: string | null;
}): Promise<GoogleCallbackResult> {
  const prisma = getPrisma();
  const input = parseCallbackInput(options.rawQuery);

  if (!prisma) {
    return safeFailResult(
      "failed",
      "Social authorization is temporarily unavailable.",
    );
  }

  if (!input.state) {
    return safeFailResult("failed", "The Google authorization response was invalid.");
  }

  if (input.code && input.error) {
    return safeFailResult(
      "failed",
      "The Google authorization response was inconsistent.",
    );
  }

  if (!input.code && !input.error) {
    return safeFailResult(
      "failed",
      "The Google authorization response was incomplete.",
    );
  }

  if (!options.profileId) {
    return safeFailResult(
      "failed",
      "Sign in again to finish Google authorization.",
    );
  }

  const stateHash = hashOAuthState(input.state);
  const oauthState = await prisma.socialOAuthState.findUnique({
    where: { stateHash },
    select: {
      id: true,
      clientId: true,
      businessBrandId: true,
      connectionId: true,
      provider: true,
      status: true,
      stateHash: true,
      returnPath: true,
      expiresAt: true,
      createdByProfileId: true,
      codeVerifierCiphertext: true,
      codeVerifierIv: true,
      codeVerifierAuthTag: true,
      metadata: true,
    },
  });

  if (
    !oauthState ||
    oauthState.provider !== "google" ||
    !verifyOAuthStateHash(input.state, oauthState.stateHash)
  ) {
    logSocialOAuthEvent("google-oauth-callback", {
      stage: "state_lookup",
      outcome: "invalid_state",
      provider: "google",
    });
    return safeFailResult("failed", "The Google authorization response was invalid.");
  }

  const returnPath = sanitizeReturnPath(oauthState.returnPath);

  if (oauthState.status === "completed") {
    logSocialOAuthEvent("google-oauth-callback", {
      stage: "state_lookup",
      outcome: "already_completed",
      provider: "google",
    });
    return {
      outcome: "accepted",
      returnPath: appendOutcome(returnPath, "accepted"),
      message: "Google authorization was already completed.",
    };
  }

  if (
    oauthState.status === "cancelled" ||
    oauthState.status === "failed" ||
    oauthState.status === "processing"
  ) {
    return safeFailResult(
      "failed",
      oauthState.status === "processing"
        ? "Google authorization is already in progress. Wait a moment and try again."
        : "This Google authorization request has already been used. Reconnect again.",
      returnPath,
    );
  }

  if (oauthState.status === "expired") {
    return safeFailResult(
      "expired",
      "This Google authorization request expired. Start a new connection.",
      returnPath,
    );
  }

  if (oauthState.status !== "pending") {
    return safeFailResult(
      "failed",
      "This Google authorization request cannot be completed.",
      returnPath,
    );
  }

  if (oauthState.expiresAt.getTime() <= Date.now()) {
    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: "expired",
      errorMessage: "Authorization attempt expired before callback completion.",
      failConnection: false,
    });
    return safeFailResult(
      "expired",
      "This Google authorization request expired. Start a new connection.",
      returnPath,
    );
  }

  if (
    !oauthState.connectionId ||
    oauthState.createdByProfileId !== options.profileId
  ) {
    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: "failed",
      errorMessage: "Initiating profile or connection eligibility failed.",
      failConnection: false,
    });
    return safeFailResult(
      "failed",
      "You are not allowed to finish this Google authorization.",
      returnPath,
    );
  }

  if (input.error) {
    const cancelled = isCancellation(input);
    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: cancelled ? "cancelled" : "failed",
      errorMessage: cancelled
        ? "User cancelled Google authorization."
        : "Google returned an authorization error.",
      failConnection: !cancelled,
    });
    logSocialOAuthEvent("google-oauth-callback", {
      stage: "provider_result",
      outcome: cancelled ? "cancelled" : "provider_error",
      provider: "google",
    });
    return safeFailResult(
      cancelled ? "cancelled" : "failed",
      cancelled
        ? "Google authorization was cancelled."
        : "Google authorization failed. You can try again.",
      returnPath,
    );
  }

  if (!input.code) {
    return safeFailResult(
      "failed",
      "The Google authorization response was incomplete.",
      returnPath,
    );
  }

  const claim = await prisma.socialOAuthState.updateMany({
    where: {
      id: oauthState.id,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    data: { status: "processing" },
  });

  if (claim.count !== 1) {
    return safeFailResult(
      "failed",
      "This Google authorization request has already been used. Start a new connection.",
      returnPath,
    );
  }

  try {
    await assertClientCanConnectSocial(prisma, oauthState.clientId, {
      provider: "google",
      reconnect: true,
    });

    const codeVerifier = decryptSocialValue({
      ciphertext: oauthState.codeVerifierCiphertext,
      iv: oauthState.codeVerifierIv,
      authTag: oauthState.codeVerifierAuthTag,
      keyVersion: readKeyVersion(oauthState.metadata),
    });

    let tokenResult;
    try {
      tokenResult = await exchangeGoogleCodeForStoredCredential({
        code: input.code,
        codeVerifier,
      });
    } catch (error) {
      if (error instanceof GoogleTokenConsumedError) {
        throw new ServiceError(
          "conflict",
          "Google authorization code is no longer valid. Reconnect again.",
        );
      }
      throw error;
    }

    const otherLive = await prisma.socialProviderConnection.findFirst({
      where: {
        clientId: oauthState.clientId,
        businessBrandId: oauthState.businessBrandId,
        provider: "google",
        status: {
          in: ["pending_authorization", "authorized", "connected"],
        },
        id: { not: oauthState.connectionId },
      },
      select: { id: true },
    });

    if (otherLive) {
      throw new ServiceError(
        "conflict",
        "This brand already has an active Google connection. Disconnect it before starting a new one.",
      );
    }

    const channels = await listYoutubeChannelsForAccessToken({
      accessToken: tokenResult.accessToken,
    });

    await completeSocialOAuthState({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      clientId: oauthState.clientId,
      provider: "google",
      profileId: options.profileId,
      externalSubjectId: tokenResult.externalSubjectId,
      displayName: tokenResult.displayName,
      scopes: tokenResult.scopes,
      tokenPayload: {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
        tokenType: tokenResult.tokenType,
        scopes: tokenResult.scopes,
        providerAccountId: tokenResult.externalSubjectId,
        issuedAt: new Date().toISOString(),
      },
      accessTokenExpiresAt: tokenResult.expiresAt,
      refreshTokenExpiresAt: null,
    });

    const persisted = await persistDiscoveredYoutubeChannels({
      clientId: oauthState.clientId,
      profileId: options.profileId,
      connectionId: oauthState.connectionId,
      channels,
    });

    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(oauthState.clientId);

    logSocialOAuthEvent("google-oauth-callback", {
      stage: "complete",
      outcome: "ok",
      provider: "google",
    });

    const message =
      persisted.selected
        ? "YouTube connected successfully."
        : persisted.storedCount === 0
          ? "Google is authorized, but this account has no YouTube channel to select."
          : "Choose a YouTube channel to finish connecting.";

    return {
      outcome: "accepted",
      returnPath: appendOutcome(returnPath, "accepted"),
      message,
    };
  } catch (error) {
    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: "failed",
      errorMessage:
        error instanceof ServiceError
          ? error.message
          : "Google authorization failed.",
      failConnection: true,
    });

    logSocialOAuthEvent("google-oauth-callback", {
      stage: "complete",
      outcome: "failed",
      provider: "google",
    });

    return safeFailResult(
      "failed",
      error instanceof ServiceError
        ? error.message
        : "Google authorization failed. You can retry.",
      returnPath,
    );
  }
}
