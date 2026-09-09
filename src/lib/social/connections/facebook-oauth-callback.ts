import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { requiresMetaUserReplacement } from "@/lib/social/connections/social-canonical-identity";
import { completeSocialOAuthState } from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { exchangeMetaCodeForStoredCredential } from "@/lib/social/providers/meta-token";
import {
  decryptSocialValue,
  hashOAuthState,
  verifyOAuthStateHash,
} from "@/lib/social/security/social-crypto";

const MAX_STATE_LENGTH = 512;
const MAX_CODE_LENGTH = 2048;
const MAX_ERROR_LENGTH = 128;
const MAX_ERROR_DESC_LENGTH = 256;

export type FacebookCallbackOutcome =
  | "accepted"
  | "cancelled"
  | "expired"
  | "failed";

export type FacebookCallbackResult = {
  outcome: FacebookCallbackOutcome;
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
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

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
  outcome: FacebookCallbackOutcome,
): string {
  const url = new URL(
    returnPath,
    "http://takatak.local",
  );
  url.searchParams.set("social_oauth", outcome);
  return `${url.pathname}${url.search}${url.hash}`;
}

function readKeyVersion(
  metadata: unknown,
): number {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return 1;
  }

  const value = (
    metadata as Record<string, unknown>
  ).keyVersion;

  return typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
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
    errorReason: clamp(
      raw.error_reason ?? null,
      MAX_ERROR_LENGTH,
    ),
    errorDescription: clamp(
      raw.error_description ?? null,
      MAX_ERROR_DESC_LENGTH,
    ),
  };
}

function isCancellation(input: CallbackInput): boolean {
  if (!input.error) {
    return false;
  }

  const blob = [
    input.error,
    input.errorReason,
    input.errorDescription,
  ]
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
  outcome: FacebookCallbackOutcome,
  message: string,
  returnPath?: string,
): FacebookCallbackResult {
  return {
    outcome,
    returnPath: appendOutcome(
      sanitizeReturnPath(returnPath),
      outcome,
    ),
    message,
  };
}

async function markOAuthAttempt(options: {
  oauthStateId: string;
  connectionId: string | null;
  status: "cancelled" | "failed" | "expired";
  errorCode: string;
  errorMessage: string;
  /** Only demote brand-new pending/authorized shells — never connected reauth shells. */
  failConnection: boolean;
  /** Preserve connected shell; mark refresh failure for UI projection. */
  markRefreshFailed?: boolean;
}): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    return;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.socialOAuthState.updateMany({
      where: {
        id: options.oauthStateId,
        status: {
          in: ["pending", "processing"],
        },
      },
      data: {
        status: options.status,
        errorMessage: options.errorMessage.slice(0, 500),
        consumedAt: now,
      },
    });

    if (
      options.markRefreshFailed &&
      options.connectionId
    ) {
      await tx.socialProviderConnection.updateMany({
        where: {
          id: options.connectionId,
          status: {
            in: ["connected", "reauthorization_required", "authorized"],
          },
        },
        data: {
          lastErrorCode: "reauthorization_failed",
          lastErrorMessage:
            "Facebook could not be reached; reconnect again.",
          lastErrorAt: now,
        },
      });
    }

    if (
      options.failConnection &&
      options.connectionId
    ) {
      await tx.socialProviderConnection.updateMany({
        where: {
          id: options.connectionId,
          status: {
            in: [
              "pending_authorization",
              "authorized",
            ],
          },
        },
        data: {
          status: "failed",
          lastErrorCode: options.errorCode.slice(0, 64),
          lastErrorMessage:
            options.errorMessage.slice(0, 500),
          lastErrorAt: now,
        },
      });
    }
  });
}

/**
 * Process Meta's browser redirect callback.
 * Never accepts Client/Brand/Profile/connection from query params.
 */
export async function processFacebookOAuthCallback(options: {
  rawQuery: Record<string, string | undefined>;
  profileId: string | null;
}): Promise<FacebookCallbackResult> {
  const prisma = getPrisma();
  const input = parseCallbackInput(options.rawQuery);

  if (!prisma) {
    return safeFailResult(
      "failed",
      "Social authorization is temporarily unavailable.",
    );
  }

  if (!input.state) {
    return safeFailResult(
      "failed",
      "The Facebook authorization response was invalid.",
    );
  }

  if (input.code && input.error) {
    return safeFailResult(
      "failed",
      "The Facebook authorization response was inconsistent.",
    );
  }

  if (!input.code && !input.error) {
    return safeFailResult(
      "failed",
      "The Facebook authorization response was incomplete.",
    );
  }

  if (!options.profileId) {
    return safeFailResult(
      "failed",
      "Sign in again to finish Facebook authorization.",
    );
  }

  const stateHash = hashOAuthState(input.state);

  const oauthState =
    await prisma.socialOAuthState.findUnique({
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

  // Unknown / mismatched state — do not reveal whether an attempt existed.
  if (
    !oauthState ||
    oauthState.provider !== "meta" ||
    !verifyOAuthStateHash(input.state, oauthState.stateHash)
  ) {
    logSocialOAuthEvent("facebook-oauth-callback", {
      stage: "state_lookup",
      outcome: "invalid_state",
      provider: "meta",
    });

    return safeFailResult(
      "failed",
      "The Facebook authorization response was invalid.",
    );
  }

  const returnPath = sanitizeReturnPath(
    oauthState.returnPath,
  );

  if (oauthState.status === "completed") {
    // Idempotent replay — do not create another connection/credential.
    logSocialOAuthEvent("facebook-oauth-callback", {
      stage: "state_lookup",
      outcome: "already_completed",
      provider: "meta",
    });
    return {
      outcome: "accepted",
      returnPath: appendOutcome(returnPath, "accepted"),
      message:
        "Facebook authorization was already completed.",
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
        ? "Facebook authorization is already in progress. Wait a moment and try again."
        : "This Facebook authorization request has already been used. Reconnect again.",
      returnPath,
    );
  }

  if (oauthState.status === "expired") {
    return safeFailResult(
      "expired",
      "This Facebook authorization request expired. Start a new connection.",
      returnPath,
    );
  }

  if (oauthState.status !== "pending") {
    return safeFailResult(
      "failed",
      "This Facebook authorization request cannot be completed.",
      returnPath,
    );
  }

  if (oauthState.expiresAt.getTime() <= Date.now()) {
    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: "expired",
      errorCode: "oauth_expired",
      errorMessage:
        "Authorization attempt expired before callback completion.",
      failConnection: false,
    });

    return safeFailResult(
      "expired",
      "This Facebook authorization request expired. Start a new connection.",
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
      errorCode: "oauth_authz_mismatch",
      errorMessage:
        "Initiating profile or connection eligibility failed.",
      failConnection: false,
    });

    return safeFailResult(
      "failed",
      "You are not allowed to finish this Facebook authorization.",
      returnPath,
    );
  }

  // Cancellation / provider denial
  if (input.error) {
    const cancelled = isCancellation(input);

    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: cancelled ? "cancelled" : "failed",
      errorCode: cancelled
        ? "oauth_cancelled"
        : "oauth_provider_error",
      errorMessage: cancelled
        ? "User cancelled Facebook authorization."
        : "Facebook returned an authorization error.",
      failConnection: !cancelled,
    });

    logSocialOAuthEvent("facebook-oauth-callback", {
      stage: "provider_result",
      outcome: cancelled ? "cancelled" : "provider_error",
      provider: "meta",
    });

    return safeFailResult(
      cancelled ? "cancelled" : "failed",
      cancelled
        ? "Facebook authorization was cancelled."
        : "Facebook authorization failed. You can try again.",
      returnPath,
    );
  }

  if (!input.code) {
    return safeFailResult(
      "failed",
      "The Facebook authorization response was incomplete.",
      returnPath,
    );
  }

  // Atomic claim: pending -> processing (only one winner).
  const claim =
    await prisma.socialOAuthState.updateMany({
      where: {
        id: oauthState.id,
        status: "pending",
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        status: "processing",
      },
    });

  if (claim.count !== 1) {
    return safeFailResult(
      "failed",
      "This Facebook authorization request has already been used. Start a new connection.",
      returnPath,
    );
  }

  try {
    await assertProfileCanManageSocialAccounts(prisma, {
      clientId: oauthState.clientId,
      profileId: options.profileId,
    });

    await assertClientCanConnectSocial(
      prisma,
      oauthState.clientId,
      { provider: "meta", reconnect: true },
    );

    const brand = await prisma.businessBrand.findFirst({
      where: {
        id: oauthState.businessBrandId,
        clientId: oauthState.clientId,
        status: { notIn: ["archived", "frozen"] },
      },
      select: { id: true },
    });

    if (!brand) {
      throw new ServiceError(
        "not_found",
        "The brand for this authorization is no longer available.",
      );
    }

    const connection =
      await prisma.socialProviderConnection.findFirst({
        where: {
          id: oauthState.connectionId,
          clientId: oauthState.clientId,
          businessBrandId: brand.id,
          provider: "meta",
        },
        select: {
          id: true,
          status: true,
          externalSubjectId: true,
        },
      });

    if (!connection) {
      throw new ServiceError(
        "not_found",
        "The provider connection for this authorization is no longer available.",
      );
    }

    if (
      connection.status !== "pending_authorization" &&
      connection.status !== "authorized" &&
      connection.status !== "connected" &&
      connection.status !== "reauthorization_required" &&
      connection.status !== "disconnected" &&
      connection.status !== "failed" &&
      connection.status !== "error" &&
      connection.status !== "expired"
    ) {
      throw new ServiceError(
        "conflict",
        "This provider connection cannot finish authorization in its current state.",
      );
    }

    const wasConnectedShell =
      connection.status === "connected" ||
      connection.status === "reauthorization_required";

    // Failed/expired shells that still own a selected Page are reconnects —
    // never treat them as first-time authorize → select flows.
    const priorSelectedPage =
      wasConnectedShell
        ? null
        : await prisma.socialAccount.findFirst({
            where: {
              clientId: oauthState.clientId,
              providerConnectionId: connection.id,
              platform: "facebook",
              accountType: "facebook_page",
              status: "connected",
              accessStatus: "selected",
            },
            select: { id: true },
          });

    const wasPreservableReauth =
      wasConnectedShell || priorSelectedPage !== null;

    const codeVerifier = decryptSocialValue({
      ciphertext: oauthState.codeVerifierCiphertext,
      iv: oauthState.codeVerifierIv,
      authTag: oauthState.codeVerifierAuthTag,
      keyVersion: readKeyVersion(oauthState.metadata),
    });

    // Network + token work stays outside any interactive DB transaction.
    const { MetaTokenConsumedError } = await import(
      "@/lib/social/providers/meta-token"
    );
    let tokenResult;
    try {
      tokenResult = await exchangeMetaCodeForStoredCredential({
        code: input.code,
        codeVerifier,
      });
    } catch (error) {
      if (error instanceof MetaTokenConsumedError) {
        throw new ServiceError(
          "conflict",
          "Facebook authorization code is no longer valid. Reconnect again.",
        );
      }
      throw error;
    }

    // Different Meta user on this shell or another live shell → explicit replacement.
    if (
      requiresMetaUserReplacement({
        existingExternalSubjectId: connection.externalSubjectId,
        incomingExternalSubjectId: tokenResult.externalSubjectId,
      })
    ) {
      throw new ServiceError(
        "conflict",
        "A different Facebook user authorized this brand. Disconnect the current Meta connection before connecting a different Facebook account.",
      );
    }

    const otherLive =
      await prisma.socialProviderConnection.findFirst({
        where: {
          clientId: oauthState.clientId,
          businessBrandId: brand.id,
          provider: "meta",
          status: {
            in: ["pending_authorization", "authorized", "connected"],
          },
          id: { not: connection.id },
        },
        select: {
          externalSubjectId: true,
        },
      });

    if (
      otherLive &&
      requiresMetaUserReplacement({
        existingExternalSubjectId: otherLive.externalSubjectId,
        incomingExternalSubjectId: tokenResult.externalSubjectId,
      })
    ) {
      throw new ServiceError(
        "conflict",
        "This brand already has a Meta connection from a different Facebook user. Disconnect it before connecting a different account.",
      );
    }

    if (otherLive) {
      throw new ServiceError(
        "conflict",
        "This brand already has an active Meta connection. Disconnect it before starting a new one.",
      );
    }

    await completeSocialOAuthState({
      oauthStateId: oauthState.id,
      connectionId: connection.id,
      clientId: oauthState.clientId,
      provider: "meta",
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
      refreshTokenExpiresAt: null,
    });

    // Credential exchange succeeded. Post-complete work must not rewrite the
    // redirect to social_oauth=failed — recover connected state best-effort.
    let preserveKind: "preserved" | "requires_selection" | "none" = "none";

    try {
      // First-time OAuth: stay authorized until Page selection.
      // Reauth (including failed shells that still own a selected Page): keep
      // preservable — completeSocialOAuthState already moved the shell to
      // authorized; preserveSelected may restore connected.
      if (!wasPreservableReauth) {
        await prisma.socialProviderConnection.updateMany({
          where: {
            id: connection.id,
            status: "connected",
          },
          data: {
            status: "authorized",
            connectedAt: null,
          },
        });
      }

      const { preserveSelectedFacebookPageAfterReauthorization } =
        await import(
          "@/lib/social/connections/social-facebook-page-service"
        );
      const preserve =
        await preserveSelectedFacebookPageAfterReauthorization({
          clientId: oauthState.clientId,
          profileId: options.profileId,
          connectionId: connection.id,
        });

      // Do not invent "preserved" without a Page token. If Meta validation was
      // temporary or preserve partially failed, keep the selected Page and let
      // the requeue path below reattach credentials via sync.

      preserveKind =
        preserve.kind === "preserved"
          ? "preserved"
          : preserve.kind === "requires_selection"
            ? "requires_selection"
            : "none";

      // Clear reauth error markers after successful credential replacement.
      await prisma.socialProviderConnection.updateMany({
        where: {
          id: connection.id,
          clientId: oauthState.clientId,
        },
        data: {
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });

      // Selected Page still present → clear stale sync auth blocks and re-sync.
      const selectedForSync = await prisma.socialAccount.findFirst({
        where: {
          clientId: oauthState.clientId,
          providerConnectionId: connection.id,
          platform: "facebook",
          accountType: "facebook_page",
          status: "connected",
          accessStatus: "selected",
        },
        select: { id: true },
      });

      if (selectedForSync) {
        // Ensure shell is connected when a selected Page remains.
        await prisma.socialProviderConnection.updateMany({
          where: {
            id: connection.id,
            clientId: oauthState.clientId,
            status: "authorized",
          },
          data: {
            status: "connected",
            connectedAt: new Date(),
            lastValidatedAt: new Date(),
          },
        });

        const { requeueFacebookPageSyncAfterCredentialRefresh } = await import(
          "@/lib/social/sync/facebook-page-initial-sync"
        );
        await requeueFacebookPageSyncAfterCredentialRefresh({
          clientId: oauthState.clientId,
          profileId: options.profileId,
          connectionId: connection.id,
          businessBrandId: brand.id,
        });
        preserveKind = "preserved";
      }
    } catch {
      // Token is already stored. Soft-recover connected if Page still selected,
      // reattach Page credentials when possible, and requeue sync.
      const stillSelected = await prisma.socialAccount.findFirst({
        where: {
          clientId: oauthState.clientId,
          providerConnectionId: connection.id,
          platform: "facebook",
          accountType: "facebook_page",
          status: "connected",
          accessStatus: "selected",
        },
        select: { id: true },
      });
      if (stillSelected) {
        try {
          const { preserveSelectedFacebookPageAfterReauthorization } =
            await import(
              "@/lib/social/connections/social-facebook-page-service"
            );
          // Preserve requires authorized; demote briefly if needed.
          await prisma.socialProviderConnection.updateMany({
            where: {
              id: connection.id,
              clientId: oauthState.clientId,
              status: "connected",
            },
            data: {
              status: "authorized",
              connectedAt: null,
            },
          });
          const preserve =
            await preserveSelectedFacebookPageAfterReauthorization({
              clientId: oauthState.clientId,
              profileId: options.profileId,
              connectionId: connection.id,
            });

          if (preserve.kind !== "preserved") {
            await prisma.socialProviderConnection.updateMany({
              where: {
                id: connection.id,
                clientId: oauthState.clientId,
                status: { in: ["authorized", "connected"] },
              },
              data: {
                status: "connected",
                connectedAt: new Date(),
                lastValidatedAt: new Date(),
                lastErrorCode: null,
                lastErrorMessage: null,
                lastErrorAt: null,
              },
            });
          }

          const { requeueFacebookPageSyncAfterCredentialRefresh } =
            await import("@/lib/social/sync/facebook-page-initial-sync");
          await requeueFacebookPageSyncAfterCredentialRefresh({
            clientId: oauthState.clientId,
            profileId: options.profileId,
            connectionId: connection.id,
            businessBrandId: brand.id,
          });
          preserveKind = "preserved";
        } catch {
          await prisma.socialProviderConnection.updateMany({
            where: {
              id: connection.id,
              clientId: oauthState.clientId,
              status: { in: ["authorized", "connected"] },
            },
            data: {
              status: "connected",
              connectedAt: new Date(),
              lastValidatedAt: new Date(),
              lastErrorCode: null,
              lastErrorMessage: null,
              lastErrorAt: null,
            },
          });
          try {
            const { requeueFacebookPageSyncAfterCredentialRefresh } =
              await import("@/lib/social/sync/facebook-page-initial-sync");
            await requeueFacebookPageSyncAfterCredentialRefresh({
              clientId: oauthState.clientId,
              profileId: options.profileId,
              connectionId: connection.id,
              businessBrandId: brand.id,
            });
            preserveKind = "preserved";
          } catch {
            preserveKind = "requires_selection";
          }
        }
      }
      logSocialOAuthEvent("facebook-oauth-callback", {
        stage: "post_complete",
        outcome: "soft_recovered",
        provider: "meta",
      });
    }

    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(oauthState.clientId);

    logSocialOAuthEvent("facebook-oauth-callback", {
      stage: "complete",
      outcome:
        preserveKind === "preserved"
          ? "accepted_preserved"
          : "accepted",
      provider: "meta",
    });

    if (preserveKind === "preserved") {
      return {
        outcome: "accepted",
        returnPath: appendOutcome(returnPath, "accepted"),
        message:
          "Facebook authorization succeeded. Your selected Page was confirmed.",
      };
    }

    return {
      outcome: "accepted",
      returnPath: appendOutcome(returnPath, "accepted"),
      message:
        "Facebook authorization succeeded. Select a Facebook Page next.",
    };
  } catch (error) {
    const { MetaTokenConsumedError } = await import(
      "@/lib/social/providers/meta-token"
    );

    const message =
      error instanceof MetaTokenConsumedError
        ? error.message
        : error instanceof ServiceError
          ? error.message
          : "Facebook could not be reached; reconnect again.";

    const preserveConnectedShell =
      Boolean(oauthState.connectionId);

    // Never demote/destroy a connected canonical shell on refresh failure.
    // If credential exchange already completed, only stamp refresh failure —
    // never demote authorized shells that still own a selected Page.
    await markOAuthAttempt({
      oauthStateId: oauthState.id,
      connectionId: oauthState.connectionId,
      status: "failed",
      errorCode:
        error instanceof MetaTokenConsumedError
          ? "oauth_code_consumed"
          : "oauth_callback_failed",
      errorMessage: message,
      failConnection: false,
      markRefreshFailed: preserveConnectedShell,
    });

    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(oauthState.clientId);

    logSocialOAuthEvent("facebook-oauth-callback", {
      stage: "complete",
      outcome: "failed",
      provider: "meta",
      errorCategory:
        error instanceof MetaTokenConsumedError
          ? "code_consumed"
          : "transient_or_unavailable",
    });

    return safeFailResult(
      "failed",
      message.includes("reconnect")
        ? message
        : `${message} Reconnect again.`,
      returnPath,
    );
  }
}
