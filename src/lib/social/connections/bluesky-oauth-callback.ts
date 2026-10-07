import "server-only";

import { Prisma } from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { createBlueskyOAuthClient } from "@/lib/social/providers/bluesky-oauth-client";
import {
  hashOAuthState,
  verifyOAuthStateHash,
} from "@/lib/social/security/social-crypto";

const MAX_STATE_LENGTH = 512;
const MAX_CODE_LENGTH = 2048;
const MAX_ERROR_LENGTH = 128;
const MAX_ERROR_DESCRIPTION_LENGTH = 512;

type CallbackOutcome =
  | "accepted"
  | "cancelled"
  | "expired"
  | "failed";

export type BlueskyOAuthCallbackResult = {
  outcome: CallbackOutcome;
  returnPath: string;
  message: string;
};

type BlueskyProfile = {
  did: string;
  handle: string;
  displayName: string | null;
  avatar: string | null;
};

function requirePrisma() {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  return prisma;
}

function clamp(
  value: string | undefined,
  max: number,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed
    ? trimmed.slice(0, max)
    : null;
}

function parseCallbackInput(
  rawQuery: Record<string, string | undefined>,
) {
  return {
    code: clamp(
      rawQuery.code,
      MAX_CODE_LENGTH,
    ),
    state: clamp(
      rawQuery.state,
      MAX_STATE_LENGTH,
    ),
    error: clamp(
      rawQuery.error,
      MAX_ERROR_LENGTH,
    ),
    errorDescription: clamp(
      rawQuery.error_description,
      MAX_ERROR_DESCRIPTION_LENGTH,
    ),
  };
}

function isSafeReturnPath(
  value: string,
): boolean {
  return (
    value.startsWith("/dashboard") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.includes("://")
  );
}

function sanitizeReturnPath(
  value: string | null | undefined,
): string {
  return value && isSafeReturnPath(value)
    ? value
    : "/dashboard/social?connections=open&platform=bluesky";
}

function appendOutcome(
  returnPath: string,
  outcome: CallbackOutcome,
): string {
  const target = new URL(
    returnPath,
    "http://takatak.local",
  );

  target.searchParams.set(
    "social_oauth",
    outcome,
  );

  return (
    target.pathname +
    target.search +
    target.hash
  );
}

function result(
  outcome: CallbackOutcome,
  message: string,
  returnPath?: string,
): BlueskyOAuthCallbackResult {
  const safePath =
    sanitizeReturnPath(returnPath);

  return {
    outcome,
    returnPath:
      appendOutcome(safePath, outcome),
    message,
  };
}

function isCancellation(input: {
  error: string | null;
  errorDescription: string | null;
}): boolean {
  if (!input.error) {
    return false;
  }

  const combined = [
    input.error,
    input.errorDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    input.error === "access_denied" ||
    combined.includes("cancel") ||
    combined.includes("denied")
  );
}

async function failClaimedAttempt(options: {
  oauthStateId: string;
  clientId: string;
  connectionId: string;
  code: string;
  message: string;
}): Promise<void> {
  const now = new Date();

  await runSocialDbTransaction(
    "bluesky-oauth-callback-failure",
    async (transaction) => {
      await transaction.socialOAuthState.updateMany({
        where: {
          id: options.oauthStateId,
          clientId: options.clientId,
          status: {
            in: ["pending", "processing"],
          },
        },
        data: {
          status: "failed",
          consumedAt: now,
          errorMessage: options.message,
        },
      });

      await transaction.socialProviderConnection.updateMany({
        where: {
          id: options.connectionId,
          clientId: options.clientId,
          provider: "bluesky",
          status: "pending_authorization",
        },
        data: {
          status: "failed",
          lastErrorCode: options.code,
          lastErrorMessage: options.message,
          lastErrorAt: now,
        },
      });
    },
  );
}

async function readBlueskyProfile(
  did: string,
  fetchHandler: (
    pathname: string,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<BlueskyProfile> {
  const response = await fetchHandler(
    `/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(
      did,
    )}`,
  );

  if (!response.ok) {
    throw new ServiceError(
      "unavailable",
      "Bluesky authorized the account but its profile could not be retrieved.",
    );
  }

  const payload =
    (await response.json()) as unknown;

  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    throw new ServiceError(
      "unavailable",
      "Bluesky returned an invalid account profile.",
    );
  }

  const record =
    payload as Record<string, unknown>;

  const returnedDid =
    typeof record.did === "string"
      ? record.did.trim()
      : "";

  const handle =
    typeof record.handle === "string"
      ? record.handle.trim()
      : "";

  if (
    returnedDid !== did ||
    !returnedDid.startsWith("did:") ||
    !handle
  ) {
    throw new ServiceError(
      "unavailable",
      "Bluesky returned an inconsistent account profile.",
    );
  }

  return {
    did: returnedDid,
    handle: handle.slice(0, 253),
    displayName:
      typeof record.displayName === "string" &&
      record.displayName.trim()
        ? record.displayName
            .trim()
            .slice(0, 240)
        : null,
    avatar:
      typeof record.avatar === "string" &&
      record.avatar.startsWith("https://")
        ? record.avatar.slice(0, 2048)
        : null,
  };
}

async function persistConnectedAccount(options: {
  oauthStateId: string;
  clientId: string;
  profileId: string;
  connectionId: string;
  profile: BlueskyProfile;
  scopes: string[];
  accessTokenExpiresAt: Date | null;
}): Promise<void> {
  const now = new Date();

  await runSocialDbTransaction(
    "bluesky-account-connect",
    async (transaction) => {
      await assertProfileCanManageSocialAccounts(
        transaction,
        {
          clientId: options.clientId,
          profileId: options.profileId,
        },
      );

      await assertClientCanConnectSocial(
        transaction,
        options.clientId,
        {
          provider: "bluesky",
          reconnect: false,
        },
      );

      const connection =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
            provider: "bluesky",
            status: "pending_authorization",
          },
          select: {
            id: true,
            businessBrandId: true,
          },
        });

      if (!connection) {
        throw new ServiceError(
          "conflict",
          "The Bluesky connection is no longer pending.",
        );
      }

      const oauthState =
        await transaction.socialOAuthState.findFirst({
          where: {
            id: options.oauthStateId,
            clientId: options.clientId,
            connectionId: options.connectionId,
            provider: "bluesky",
            status: "processing",
          },
          select: {
            id: true,
          },
        });

      if (!oauthState) {
        throw new ServiceError(
          "conflict",
          "The Bluesky authorization attempt is no longer active.",
        );
      }

      const duplicate =
        await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            platform: "bluesky",
            externalAccountId:
              options.profile.did,
            status: "connected",
            NOT: {
              providerConnectionId:
                connection.id,
            },
          },
          select: {
            id: true,
          },
        });

      if (duplicate) {
        throw new ServiceError(
          "conflict",
          "This Bluesky account is already connected in this workspace.",
        );
      }

      const displayName =
        options.profile.displayName ||
        options.profile.handle;

      const existing =
        await transaction.socialAccount.findFirst({
          where: {
            providerConnectionId:
              connection.id,
            platform: "bluesky",
            externalAccountId:
              options.profile.did,
          },
          select: {
            id: true,
          },
        });

      const account = existing
        ? await transaction.socialAccount.update({
            where: {
              id: existing.id,
            },
            data: {
              businessBrandId:
                connection.businessBrandId,
              handle:
                options.profile.handle,
              displayName,
              profileUrl:
                `https://bsky.app/profile/${encodeURIComponent(
                  options.profile.handle,
                )}`,
              profileImageUrl:
                options.profile.avatar,
              accountType:
                "bluesky_profile",
              status: "connected",
              accessStatus: "selected",
              isAvailableThroughAuth: true,
              lastDiscoveredAt: now,
              lastSyncAt: now,
              metadata: {
                source: "atproto_oauth",
                did: options.profile.did,
              },
            },
            select: {
              id: true,
            },
          })
        : await transaction.socialAccount.create({
            data: {
              clientId:
                options.clientId,
              businessBrandId:
                connection.businessBrandId,
              providerConnectionId:
                connection.id,
              platform: "bluesky",
              externalAccountId:
                options.profile.did,
              handle:
                options.profile.handle,
              displayName,
              profileUrl:
                `https://bsky.app/profile/${encodeURIComponent(
                  options.profile.handle,
                )}`,
              profileImageUrl:
                options.profile.avatar,
              accountType:
                "bluesky_profile",
              status: "connected",
              accessStatus: "selected",
              isAvailableThroughAuth: true,
              firstDiscoveredAt: now,
              lastDiscoveredAt: now,
              lastSyncAt: now,
              metadata: {
                source: "atproto_oauth",
                did: options.profile.did,
              },
            },
            select: {
              id: true,
            },
          });

      await transaction.socialAccount.updateMany({
        where: {
          clientId:
            options.clientId,
          providerConnectionId:
            connection.id,
          platform: "bluesky",
          status: "connected",
          NOT: {
            id: account.id,
          },
        },
        data: {
          status: "not_connected",
          accessStatus: "available",
          businessBrandId: null,
        },
      });

      await transaction.socialProviderConnection.update({
        where: {
          id: connection.id,
        },
        data: {
          status: "connected",
          externalSubjectId:
            options.profile.did,
          displayName,
          scopes: options.scopes,
          accessTokenExpiresAt:
            options.accessTokenExpiresAt,
          authorizedAt: now,
          connectedAt: now,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
          metadata: {
            authorizationProtocol:
              "atproto_oauth",
            accountHandle:
              options.profile.handle,
            sessionStorage:
              "encrypted_bluesky_oauth_store",
          },
        },
      });

      await transaction.socialOAuthState.update({
        where: {
          id: options.oauthStateId,
        },
        data: {
          status: "completed",
          consumedAt: now,
          errorMessage: null,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId:
            options.profileId,
          clientId:
            options.clientId,
          action:
            "social.connection.connected",
          entityType:
            "social_provider_connection",
          entityId:
            connection.id,
          metadata: {
            provider: "bluesky",
            businessBrandId:
              connection.businessBrandId,
            protocol: "atproto_oauth",
          },
        },
      });
    },
  );
}

export async function processBlueskyOAuthCallback(options: {
  rawQuery: Record<string, string | undefined>;
  profileId: string | null;
}): Promise<BlueskyOAuthCallbackResult> {
  const prisma = requirePrisma();
  const input =
    parseCallbackInput(options.rawQuery);

  if (!input.state) {
    return result(
      "failed",
      "The Bluesky authorization response was invalid.",
    );
  }

  if (
    (input.code && input.error) ||
    (!input.code && !input.error)
  ) {
    return result(
      "failed",
      "The Bluesky authorization response was inconsistent.",
    );
  }

  /*
   * The state received from Bluesky is the protocol state generated by the
   * ATProto SDK. Resolve its encrypted SDK record first to recover the exact
   * workspace and connection context. The application state supplied to
   * client.authorize() is validated after client.callback() returns it.
   */
  const sdkStateMatches =
    await prisma.blueskyOAuthStore.findMany({
      where: {
        kind: "state",
        storeKey: input.state,
      },
      select: {
        clientId: true,
        connectionId: true,
      },
      take: 2,
    });

  const sdkStateContext =
    sdkStateMatches.length === 1
      ? sdkStateMatches[0]
      : null;

  const oauthState = sdkStateContext
    ? await prisma.socialOAuthState.findFirst({
        where: {
          clientId: sdkStateContext.clientId,
          connectionId:
            sdkStateContext.connectionId,
          provider: "bluesky",
          status: {
            in: ["pending", "processing"],
          },
        },
        select: {
          id: true,
          clientId: true,
          businessBrandId: true,
          connectionId: true,
          provider: true,
          status: true,
          stateHash: true,
          createdByProfileId: true,
          returnPath: true,
          expiresAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : null;

  if (
    !oauthState ||
    oauthState.provider !== "bluesky" ||
    !oauthState.connectionId
  ) {
    logSocialOAuthEvent(
      "bluesky-oauth-callback",
      {
        stage: "state_lookup",
        outcome: "invalid_state",
        provider: "bluesky",
      },
    );

    return result(
      "failed",
      "The Bluesky authorization response was invalid.",
    );
  }

  const returnPath =
    sanitizeReturnPath(
      oauthState.returnPath,
    );

  /*
   * Loopback ATProto callbacks use 127.0.0.1 while local TAKATAK sessions
   * use localhost. Bind callback completion to the profile recorded when
   * the single-use OAuth state was created instead of depending on a
   * cross-host browser cookie.
   */
  const profileId =
    options.profileId ??
    oauthState.createdByProfileId;

  if (!profileId) {
    return result(
      "failed",
      "The Bluesky authorization profile could not be verified. Start the connection again.",
      returnPath,
    );
  }

  if (
    options.profileId &&
    options.profileId !==
      oauthState.createdByProfileId
  ) {
    return result(
      "failed",
      "The Bluesky authorization response belongs to another signed-in profile.",
      returnPath,
    );
  }

  await assertProfileCanManageSocialAccounts(
    prisma,
    {
      clientId: oauthState.clientId,
      profileId,
    },
  );

  if (isCancellation(input)) {
    const now = new Date();

    await runSocialDbTransaction(
      "bluesky-oauth-cancelled",
      async (transaction) => {
        await transaction.socialOAuthState.updateMany({
          where: {
            id: oauthState.id,
            status: {
              in: [
                "pending",
                "processing",
              ],
            },
          },
          data: {
            status: "cancelled",
            consumedAt: now,
          },
        });

        await transaction.socialProviderConnection.updateMany({
          where: {
            id: oauthState.connectionId!,
            clientId: oauthState.clientId,
            provider: "bluesky",
            status: "pending_authorization",
          },
          data: {
            status: "not_connected",
            lastErrorCode: null,
            lastErrorMessage: null,
            lastErrorAt: null,
          },
        });

        await transaction.blueskyOAuthStore.deleteMany({
          where: {
            clientId:
              oauthState.clientId,
            connectionId:
              oauthState.connectionId!,
            kind: "state",
          },
        });
      },
    );

    return result(
      "cancelled",
      "Bluesky authorization was cancelled.",
      returnPath,
    );
  }

  if (
    oauthState.expiresAt.getTime() <=
    Date.now()
  ) {
    await failClaimedAttempt({
      oauthStateId: oauthState.id,
      clientId: oauthState.clientId,
      connectionId:
        oauthState.connectionId,
      code: "authorization_expired",
      message:
        "Bluesky authorization expired. Start again.",
    });

    return result(
      "expired",
      "Bluesky authorization expired. Start again.",
      returnPath,
    );
  }

  if (!input.code) {
    return result(
      "failed",
      input.errorDescription ||
        "Bluesky authorization could not be completed.",
      returnPath,
    );
  }

  const claimed =
    await prisma.socialOAuthState.updateMany({
      where: {
        id: oauthState.id,
        clientId: oauthState.clientId,
        connectionId:
          oauthState.connectionId,
        provider: "bluesky",
        status: "pending",
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        status: "processing",
      },
    });

  if (claimed.count !== 1) {
    return result(
      "failed",
      "This Bluesky authorization response was already used or is no longer active.",
      returnPath,
    );
  }

  let session:
    Awaited<
      ReturnType<
        Awaited<
          ReturnType<
            typeof createBlueskyOAuthClient
          >
        >["callback"]
      >
    >["session"] | null = null;

  try {
    const client =
      await createBlueskyOAuthClient({
        clientId:
          oauthState.clientId,
        connectionId:
          oauthState.connectionId,
      });

    const callbackParameters =
      new URLSearchParams();

    callbackParameters.set(
      "code",
      input.code,
    );
    callbackParameters.set(
      "state",
      input.state,
    );

    const issuer = options.rawQuery.iss;

    if (
      typeof issuer !== "string" ||
      issuer.length === 0 ||
      issuer.length > 2048
    ) {
      throw new ServiceError(
        "forbidden",
        "Bluesky returned an authorization response without a valid issuer.",
      );
    }

    callbackParameters.set(
      "iss",
      issuer,
    );

    const callbackResult =
      await client.callback(
        callbackParameters,
      );

    if (
      typeof callbackResult.state !== "string" ||
      !verifyOAuthStateHash(
        callbackResult.state,
        oauthState.stateHash,
      )
    ) {
      throw new ServiceError(
        "forbidden",
        "Bluesky returned a mismatched authorization state.",
      );
    }

    session = callbackResult.session;

    const profile =
      await readBlueskyProfile(
        session.did,
        session.fetchHandler.bind(
          session,
        ),
      );

    const tokenInfo =
      await session.getTokenInfo(
        "auto",
      );

    const scopes = String(
      tokenInfo.scope,
    )
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean);

    await persistConnectedAccount({
      oauthStateId:
        oauthState.id,
      clientId:
        oauthState.clientId,
      profileId,
      connectionId:
        oauthState.connectionId,
      profile,
      scopes,
      accessTokenExpiresAt:
        tokenInfo.expiresAt ?? null,
    });
  } catch (error) {
    if (session) {
      try {
        await session.signOut();
      } catch {
        // Callback failure cleanup is best-effort.
      }
    }

    const callbackError = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };

    const safeErrorText = (value: unknown) =>
      typeof value === "string"
        ? value
            .replace(
              /(access_token|refresh_token|authorization|code|secret)=([^&\\s]+)/gi,
              "$1=[redacted]",
            )
            .slice(0, 500)
        : null;

    const callbackCause =
      callbackError.cause instanceof Error
        ? callbackError.cause
        : null;

    console.error(
      "[bluesky-oauth-callback] completion_error",
      {
        name:
          typeof callbackError.name === "string"
            ? callbackError.name
            : "UnknownError",
        code:
          typeof callbackError.code === "string"
            ? callbackError.code.slice(0, 100)
            : null,
        message: safeErrorText(
          callbackError.message,
        ),
        causeName: callbackCause?.name ?? null,
        causeMessage: safeErrorText(
          callbackCause?.message,
        ),
      },
    );

    const duplicate =
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002";

    const message = duplicate
      ? "This Bluesky account is already connected in this workspace."
      : error instanceof ServiceError
        ? error.message
        : "Bluesky authorization failed. You can try again.";

    await failClaimedAttempt({
      oauthStateId:
        oauthState.id,
      clientId:
        oauthState.clientId,
      connectionId:
        oauthState.connectionId,
      code: duplicate
        ? "duplicate_account"
        : "authorization_callback_failed",
      message,
    });

    logSocialOAuthEvent(
      "bluesky-oauth-callback",
      {
        stage: "complete",
        outcome: "failed",
        provider: "bluesky",
        connectionId:
          oauthState.connectionId,
      },
    );

    return result(
      "failed",
      message,
      returnPath,
    );
  }

  const {
    invalidateBrandSelectorCache,
  } = await import(
    "@/lib/security/brand-context"
  );

  invalidateBrandSelectorCache(
    oauthState.clientId,
  );

  logSocialOAuthEvent(
    "bluesky-oauth-callback",
    {
      stage: "complete",
      outcome: "ok",
      provider: "bluesky",
      connectionId:
        oauthState.connectionId,
    },
  );

  return result(
    "accepted",
    "Bluesky connected successfully.",
    returnPath,
  );
}
