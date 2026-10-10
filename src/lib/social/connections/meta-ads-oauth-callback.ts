import "server-only";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { syncDiscoveredMetaAdAccounts } from "@/lib/social/connections/meta-ads-account-service";
import { completeSocialOAuthState } from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { exchangeMetaAdsCode } from "@/lib/social/providers/meta-ads-accounts";
import {
  decryptSocialValue,
  hashOAuthState,
  verifyOAuthStateHash,
} from "@/lib/social/security/social-crypto";

const MAX_STATE_LENGTH = 512;
const MAX_CODE_LENGTH = 2048;
const MAX_ERROR_LENGTH = 128;
const MAX_ERROR_DESC_LENGTH = 256;

export type MetaAdsOAuthCallbackOutcome =
  | "accepted"
  | "cancelled"
  | "expired"
  | "failed"
  | "conflict";

export type MetaAdsOAuthCallbackResult = {
  outcome: MetaAdsOAuthCallbackOutcome;
  returnPath: string;
  message: string;
};

function clamp(value: string | null, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
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
  return "/dashboard/social/meta_ads";
}

function appendOutcome(
  returnPath: string,
  outcome: MetaAdsOAuthCallbackOutcome,
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

function fail(
  outcome: MetaAdsOAuthCallbackOutcome,
  message: string,
  returnPath?: string,
): MetaAdsOAuthCallbackResult {
  return {
    outcome,
    returnPath: appendOutcome(sanitizeReturnPath(returnPath), outcome),
    message,
  };
}

export async function processMetaAdsOAuthCallback(options: {
  rawQuery: Record<string, string | undefined>;
  profileId: string | null;
}): Promise<MetaAdsOAuthCallbackResult> {
  const prisma = getPrisma();
  const input = parseCallbackInput(options.rawQuery);

  if (!prisma) {
    return fail("failed", "Social authorization is temporarily unavailable.");
  }

  if (!input.state) {
    return fail("failed", "The Meta Ads authorization response was invalid.");
  }

  if (input.code && input.error) {
    return fail("failed", "The Meta Ads authorization response was inconsistent.");
  }

  if (!input.code && !input.error) {
    return fail("failed", "The Meta Ads authorization response was incomplete.");
  }

  if (!options.profileId) {
    return fail("failed", "Sign in again to finish Meta Ads authorization.");
  }

  const stateHash = hashOAuthState(input.state);
  const oauthState = await prisma.socialOAuthState.findUnique({
    where: { stateHash },
    select: {
      id: true,
      clientId: true,
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
    oauthState.provider !== "meta_ads" ||
    !verifyOAuthStateHash(input.state, oauthState.stateHash)
  ) {
    logSocialOAuthEvent("meta-ads-oauth-callback", {
      stage: "state_lookup",
      outcome: "invalid_state",
      provider: "meta_ads",
    });
    return fail("failed", "The Meta Ads authorization response was invalid.");
  }

  const returnPath = sanitizeReturnPath(oauthState.returnPath);

  if (!oauthState.connectionId) {
    return fail(
      "failed",
      "Meta Ads authorization could not be completed.",
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
    logSocialOAuthEvent("meta-ads-oauth-callback", {
      stage: "user",
      outcome: "cancelled",
      provider: "meta_ads",
    });
    return {
      outcome: "cancelled",
      returnPath: appendOutcome(returnPath, "cancelled"),
      message: "Meta Ads authorization was cancelled.",
    };
  }

  if (oauthState.expiresAt.getTime() <= Date.now()) {
    return fail(
      "expired",
      "Meta Ads authorization expired. Start again.",
      returnPath,
    );
  }

  if (oauthState.status !== "pending" && oauthState.status !== "processing") {
    return fail(
      "failed",
      "This Meta Ads authorization request has already been used.",
      returnPath,
    );
  }

  if (!input.code) {
    return fail(
      "failed",
      "Meta Ads authorization could not be completed.",
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
    return fail(
      "failed",
      "Meta Ads authorization could not be completed.",
      returnPath,
    );
  }

  let tokenResult: Awaited<ReturnType<typeof exchangeMetaAdsCode>>;
  try {
    tokenResult = await exchangeMetaAdsCode({
      code: input.code,
      codeVerifier,
    });
  } catch (error) {
    logSocialOAuthEvent("meta-ads-oauth-callback", {
      stage: "token",
      outcome: "failed",
      provider: "meta_ads",
    });
    return fail(
      "failed",
      error instanceof ServiceError
        ? error.message
        : "Meta Ads authorization failed. You can retry.",
      returnPath,
    );
  }

  try {
    await completeSocialOAuthState({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      clientId: oauthState.clientId,
      provider: "meta_ads",
      profileId: options.profileId,
      externalSubjectId: tokenResult.externalSubjectId,
      displayName: tokenResult.displayName,
      scopes: tokenResult.scopes,
      tokenPayload: {
        accessToken: tokenResult.accessToken,
        refreshToken: null,
        tokenType: tokenResult.tokenType,
        scopes: tokenResult.scopes,
        providerAccountId: tokenResult.externalSubjectId,
        issuedAt: new Date().toISOString(),
      },
      accessTokenExpiresAt: tokenResult.expiresAt,
    });

    const synced = await syncDiscoveredMetaAdAccounts({
      clientId: oauthState.clientId,
      profileId: options.profileId,
      connectionId: oauthState.connectionId,
      accounts: tokenResult.adAccounts,
    });

    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(oauthState.clientId);

    logSocialOAuthEvent("meta-ads-oauth-callback", {
      stage: "complete",
      outcome: synced.selected ? "connected" : "choose",
      provider: "meta_ads",
      eligibleCount: tokenResult.adAccounts.length,
    });

    return {
      outcome: "accepted",
      returnPath: appendOutcome(returnPath, "accepted"),
      message: synced.selected
        ? "Meta Ads connected successfully."
        : tokenResult.adAccounts.length > 1
          ? "Choose a Meta ad account to finish connecting."
          : "No Meta ad accounts were available for this Facebook login.",
    };
  } catch (error) {
    if (
      error instanceof ServiceError &&
      error.code === "conflict"
    ) {
      return fail("conflict", error.message, returnPath);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(
        "conflict",
        "This Meta ad account is already connected in this workspace.",
        returnPath,
      );
    }

    logSocialOAuthEvent("meta-ads-oauth-callback", {
      stage: "persist",
      outcome: "failed",
      provider: "meta_ads",
    });

    return fail(
      "failed",
      error instanceof ServiceError
        ? error.message
        : "Meta Ads could not be connected.",
      returnPath,
    );
  }
}
