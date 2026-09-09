import "server-only";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { completeSocialOAuthState } from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  decryptSocialValue,
  hashOAuthState,
  verifyOAuthStateHash,
} from "@/lib/social/security/social-crypto";
import type { SocialConnectionProviderValue } from "@/lib/social/providers/types";
import { Prisma } from "@prisma/client";

const MAX_STATE_LENGTH = 512;
const MAX_CODE_LENGTH = 2048;
const MAX_ERROR_LENGTH = 128;
const MAX_ERROR_DESC_LENGTH = 256;

export type DirectOAuthCallbackOutcome =
  | "accepted"
  | "cancelled"
  | "expired"
  | "failed";

export type DirectOAuthCallbackResult = {
  outcome: DirectOAuthCallbackOutcome;
  returnPath: string;
  message: string;
};

export type DirectAccountTokenResult = {
  accessToken: string;
  refreshToken?: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  refreshExpiresAt?: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
  handle: string | null;
  profileImageUrl: string | null;
};

type DirectAccountPlatform = "instagram" | "threads" | "tiktok" | "x";

function providerLabel(platform: DirectAccountPlatform): string {
  if (platform === "instagram") return "Instagram";
  if (platform === "threads") return "Threads";
  if (platform === "x") return "X";
  return "TikTok";
}

function accountTypeForPlatform(platform: DirectAccountPlatform): string {
  if (platform === "instagram") return "instagram_professional";
  if (platform === "threads") return "threads_profile";
  if (platform === "x") return "x_user";
  return "tiktok_user";
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
  outcome: DirectOAuthCallbackOutcome,
): string {
  const url = new URL(returnPath, "http://takatak.local");
  url.searchParams.set("social_oauth", outcome);
  return `${url.pathname}${url.search}${url.hash}`;
}

function parseCallbackInput(raw: Record<string, string | undefined>) {
  return {
    code: clamp(raw.code ?? null, MAX_CODE_LENGTH),
    state: clamp(raw.state ?? null, MAX_STATE_LENGTH),
    error: clamp(raw.error ?? null, MAX_ERROR_LENGTH),
    errorReason: clamp(raw.error_reason ?? null, MAX_ERROR_LENGTH),
    errorDescription: clamp(
      raw.error_description ?? null,
      MAX_ERROR_DESC_LENGTH,
    ),
  };
}

function isCancellation(input: ReturnType<typeof parseCallbackInput>): boolean {
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
  outcome: DirectOAuthCallbackOutcome,
  message: string,
  returnPath?: string,
): DirectOAuthCallbackResult {
  return {
    outcome,
    returnPath: appendOutcome(sanitizeReturnPath(returnPath), outcome),
    message,
  };
}

async function persistConnectedDirectAccount(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  platform: DirectAccountPlatform;
  accountType: string;
  externalAccountId: string;
  displayName: string | null;
  handle: string | null;
  profileImageUrl: string | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  await runSocialDbTransaction(
    `${options.platform}-account-connect`,
    async (transaction) => {
      await assertProfileCanManageSocialAccounts(transaction, {
        clientId: options.clientId,
        profileId: options.profileId,
      });

      const reconnectingX =
        options.platform === "x"
          ? Boolean(
              await transaction.socialAccount.findFirst({
                where: {
                  clientId: options.clientId,
                  providerConnectionId: options.connectionId,
                  platform: "x",
                  status: {
                    in: [
                      "connected",
                      "expired",
                      "error",
                      "pending_connection",
                    ],
                  },
                },
                select: { id: true },
              }),
            )
          : true;

      await assertClientCanConnectSocial(transaction, options.clientId, {
        provider: options.platform,
        reconnect: reconnectingX,
      });

      const connection =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
            provider: options.platform,
          },
          select: { id: true, businessBrandId: true },
        });

      if (!connection) {
        throw new ServiceError(
          "not_found",
          "The social provider connection could not be found.",
        );
      }

      const duplicate = await transaction.socialAccount.findFirst({
        where: {
          clientId: options.clientId,
          platform: options.platform,
          externalAccountId: options.externalAccountId,
          status: "connected",
          NOT: { providerConnectionId: connection.id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ServiceError(
          "conflict",
          `This ${providerLabel(options.platform)} account is already connected in this workspace.`,
        );
      }

      const now = new Date();
      const displayName =
        options.displayName?.trim() ||
        options.handle?.trim() ||
        `${providerLabel(options.platform)} account`;

      const existing = await transaction.socialAccount.findFirst({
        where: {
          providerConnectionId: connection.id,
          platform: options.platform,
          externalAccountId: options.externalAccountId,
        },
        select: { id: true },
      });

      const account = existing
        ? await transaction.socialAccount.update({
            where: { id: existing.id },
            data: {
              businessBrandId: connection.businessBrandId,
              handle: options.handle,
              displayName,
              profileImageUrl: options.profileImageUrl,
              accountType: options.accountType,
              status: "connected",
              accessStatus: "selected",
              isAvailableThroughAuth: true,
              lastDiscoveredAt: now,
              metadata: { source: `${options.platform}_login` },
            },
            select: { id: true },
          })
        : await transaction.socialAccount.create({
            data: {
              clientId: options.clientId,
              businessBrandId: connection.businessBrandId,
              providerConnectionId: connection.id,
              platform: options.platform,
              accountType: options.accountType,
              externalAccountId: options.externalAccountId,
              handle: options.handle,
              displayName,
              profileImageUrl: options.profileImageUrl,
              status: "connected",
              accessStatus: "selected",
              isAvailableThroughAuth: true,
              firstDiscoveredAt: now,
              lastDiscoveredAt: now,
              metadata: { source: `${options.platform}_login` },
            },
            select: { id: true },
          });

      await transaction.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId: connection.id,
          platform: options.platform,
          status: "connected",
          NOT: { id: account.id },
        },
        data: {
          status: "not_connected",
          accessStatus: "available",
          businessBrandId: null,
        },
      });

      await transaction.socialProviderConnection.update({
        where: { id: connection.id },
        data: {
          status: "connected",
          connectedAt: now,
          displayName,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });
    },
  );
}

export async function processDirectAccountOAuthCallback(options: {
  provider: Extract<
    SocialConnectionProviderValue,
    "instagram" | "threads" | "tiktok" | "x"
  >;
  rawQuery: Record<string, string | undefined>;
  profileId: string | null;
  exchangeCode: (input: {
    code: string;
    codeVerifier: string;
  }) => Promise<DirectAccountTokenResult>;
}): Promise<DirectOAuthCallbackResult> {
  const prisma = getPrisma();
  const input = parseCallbackInput(options.rawQuery);
  const label = providerLabel(options.provider);
  const logName = `${options.provider}-oauth-callback`;

  if (!prisma) {
    return safeFailResult(
      "failed",
      "Social authorization is temporarily unavailable.",
    );
  }

  if (!input.state) {
    return safeFailResult("failed", `The ${label} authorization response was invalid.`);
  }

  if (input.code && input.error) {
    return safeFailResult(
      "failed",
      `The ${label} authorization response was inconsistent.`,
    );
  }

  if (!input.code && !input.error) {
    return safeFailResult(
      "failed",
      `The ${label} authorization response was incomplete.`,
    );
  }

  if (!options.profileId) {
    return safeFailResult(
      "failed",
      `Sign in again to finish ${label} authorization.`,
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
      codeVerifierCiphertext: true,
      codeVerifierIv: true,
      codeVerifierAuthTag: true,
      metadata: true,
    },
  });

  if (
    !oauthState ||
    oauthState.provider !== options.provider ||
    !verifyOAuthStateHash(input.state, oauthState.stateHash)
  ) {
    logSocialOAuthEvent(logName, {
      stage: "state_lookup",
      outcome: "invalid_state",
      provider: options.provider,
    });
    return safeFailResult("failed", `The ${label} authorization response was invalid.`);
  }

  const returnPath = sanitizeReturnPath(oauthState.returnPath);

  if (!oauthState.connectionId) {
    return safeFailResult(
      "failed",
      `${label} authorization could not be completed.`,
      returnPath,
    );
  }

  if (isCancellation(input)) {
    await prisma.socialOAuthState.updateMany({
      where: {
        id: oauthState.id,
        status: { in: ["pending", "processing"] },
      },
      data: {
        status: "cancelled",
        consumedAt: new Date(),
      },
    });
    logSocialOAuthEvent(logName, {
      stage: "user",
      outcome: "cancelled",
      provider: options.provider,
    });
    return {
      outcome: "cancelled",
      returnPath: appendOutcome(returnPath, "cancelled"),
      message: `${label} authorization was cancelled.`,
    };
  }

  if (oauthState.expiresAt.getTime() <= Date.now()) {
    return safeFailResult(
      "expired",
      `${label} authorization expired. Start again.`,
      returnPath,
    );
  }

  if (!input.code) {
    return safeFailResult(
      "failed",
      `${label} authorization could not be completed.`,
      returnPath,
    );
  }

  let codeVerifier: string;
  try {
    codeVerifier = decryptSocialValue({
      ciphertext: oauthState.codeVerifierCiphertext,
      iv: oauthState.codeVerifierIv,
      authTag: oauthState.codeVerifierAuthTag,
      keyVersion: readKeyVersion(oauthState.metadata),
    });
  } catch {
    return safeFailResult(
      "failed",
      `${label} authorization could not be completed.`,
      returnPath,
    );
  }

  let tokenResult: DirectAccountTokenResult;
  try {
    tokenResult = await options.exchangeCode({
      code: input.code,
      codeVerifier,
    });
  } catch (error) {
    logSocialOAuthEvent(logName, {
      stage: "token",
      outcome: "failed",
      provider: options.provider,
    });
    const message =
      error instanceof ServiceError
        ? error.message
        : `${label} authorization failed. You can retry.`;
    return safeFailResult("failed", message, returnPath);
  }

  try {
    await completeSocialOAuthState({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      clientId: oauthState.clientId,
      provider: options.provider,
      profileId: options.profileId,
      externalSubjectId: tokenResult.externalSubjectId,
      displayName: tokenResult.displayName,
      scopes: tokenResult.scopes,
      tokenPayload: {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken ?? null,
        tokenType: tokenResult.tokenType,
        scopes: tokenResult.scopes,
        providerAccountId: tokenResult.externalSubjectId,
        issuedAt: new Date().toISOString(),
      },
      accessTokenExpiresAt: tokenResult.expiresAt,
      refreshTokenExpiresAt: tokenResult.refreshExpiresAt ?? null,
    });

    await persistConnectedDirectAccount({
      clientId: oauthState.clientId,
      profileId: options.profileId,
      connectionId: oauthState.connectionId,
      platform: options.provider,
      accountType: accountTypeForPlatform(options.provider),
      externalAccountId: tokenResult.externalSubjectId,
      displayName: tokenResult.displayName,
      handle: tokenResult.handle,
      profileImageUrl: tokenResult.profileImageUrl,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return safeFailResult(
        "failed",
        `This ${label} account is already connected in this workspace.`,
        returnPath,
      );
    }

    logSocialOAuthEvent(logName, {
      stage: "persist",
      outcome: "failed",
      provider: options.provider,
    });

    return safeFailResult(
      "failed",
      error instanceof ServiceError
        ? error.message
        : `${label} could not be connected.`,
      returnPath,
    );
  }

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(oauthState.clientId);

  logSocialOAuthEvent(logName, {
    stage: "complete",
    outcome: "ok",
    provider: options.provider,
  });

  return {
    outcome: "accepted",
    returnPath: appendOutcome(returnPath, "accepted"),
    message: `${label} connected successfully.`,
  };
}
