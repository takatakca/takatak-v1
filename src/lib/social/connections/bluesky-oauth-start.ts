import "server-only";

import type {
  Prisma,
  SocialConnectionProvider,
} from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { createBlueskyOAuthClient } from "@/lib/social/providers/bluesky-oauth-client";
import {
  createOAuthStateValue,
  encryptSocialValue,
  hashOAuthState,
} from "@/lib/social/security/social-crypto";

const OAUTH_STATE_LIFETIME_MINUTES = 10;

const LIVE_OR_PENDING_STATUSES = [
  "pending_authorization",
  "authorized",
  "connected",
] as const;

const REUSABLE_CONNECTION_STATUSES = [
  "not_connected",
  "disconnected",
  "failed",
  "expired",
  "error",
  "reauthorization_required",
] as const;

type PrismaTransaction = Prisma.TransactionClient;

export type CreatedBlueskyOAuthState = {
  authorizationUrl: string;
  expiresAt: string;
  provider: "bluesky";
  connectionId: string;
  mode: "start";
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

export function normalizeBlueskyIdentifier(
  input: unknown,
): string {
  if (typeof input !== "string") {
    throw new ServiceError(
      "invalid_input",
      "Enter your Bluesky handle.",
      { status: 400 },
    );
  }

  const identifier = input
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();

  if (
    identifier.length < 3 ||
    identifier.length > 253 ||
    identifier.includes("://") ||
    identifier.includes("/") ||
    identifier.includes("\\") ||
    /\s/.test(identifier) ||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(identifier)
  ) {
    throw new ServiceError(
      "invalid_input",
      "Enter a valid Bluesky handle, for example name.bsky.social.",
      { status: 400 },
    );
  }

  return identifier;
}

function validateReturnPath(input: unknown): string {
  const value =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "/dashboard/social?connections=open&platform=bluesky";

  if (
    !value.startsWith("/dashboard") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://")
  ) {
    throw new ServiceError(
      "invalid_input",
      "The return path is invalid.",
      { status: 400 },
    );
  }

  return value;
}

async function createConnectionShell(
  transaction: PrismaTransaction,
  options: {
    clientId: string;
    profileId: string;
    businessBrandId: string;
  },
): Promise<string> {
  await transaction.$executeRaw`
    SELECT id
    FROM social_provider_connections
    WHERE "clientId" = ${options.clientId}::uuid
      AND "businessBrandId" = ${options.businessBrandId}::uuid
      AND provider = ${"bluesky"}::"SocialConnectionProvider"
    FOR UPDATE
  `;

  const blocking =
    await transaction.socialProviderConnection.findFirst({
      where: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        provider: "bluesky",
        status: {
          in: [...LIVE_OR_PENDING_STATUSES],
        },
      },
      select: {
        id: true,
        status: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

  if (blocking) {
    const message =
      blocking.status === "pending_authorization"
        ? "A Bluesky authorization is already pending. Continue or cancel it before starting again."
        : "This brand already has a live Bluesky connection.";

    throw new ServiceError(
      "conflict",
      message,
      { status: 409 },
    );
  }

  const reusable =
    await transaction.socialProviderConnection.findFirst({
      where: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        provider: "bluesky",
        status: {
          in: [...REUSABLE_CONNECTION_STATUSES],
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

  const connection = reusable
    ? await transaction.socialProviderConnection.update({
        where: {
          id: reusable.id,
        },
        data: {
          status: "pending_authorization",
          externalSubjectId: null,
          displayName: null,
          scopes: [],
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          authorizedAt: null,
          connectedAt: null,
          disconnectedAt: null,
          lastValidatedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
          createdByProfileId: options.profileId,
          metadata: {
            authorizationProtocol: "atproto_oauth",
          },
        },
        select: {
          id: true,
        },
      })
    : await transaction.socialProviderConnection.create({
        data: {
          clientId: options.clientId,
          businessBrandId: options.businessBrandId,
          provider:
            "bluesky" as SocialConnectionProvider,
          status: "pending_authorization",
          createdByProfileId: options.profileId,
          metadata: {
            authorizationProtocol: "atproto_oauth",
          },
        },
        select: {
          id: true,
        },
      });

  await transaction.socialOAuthState.updateMany({
    where: {
      clientId: options.clientId,
      connectionId: connection.id,
      provider: "bluesky",
      status: {
        in: ["pending", "processing"],
      },
    },
    data: {
      status: "cancelled",
      consumedAt: new Date(),
      errorMessage:
        "Superseded by a newer Bluesky authorization attempt.",
    },
  });

  await transaction.blueskyOAuthStore.deleteMany({
    where: {
      clientId: options.clientId,
      connectionId: connection.id,
      kind: "state",
    },
  });

  return connection.id;
}

async function markStartFailure(options: {
  clientId: string;
  connectionId: string;
}): Promise<void> {
  const prisma = requirePrisma();

  await prisma.socialProviderConnection.updateMany({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "bluesky",
      status: "pending_authorization",
    },
    data: {
      status: "failed",
      lastErrorCode: "authorization_start_failed",
      lastErrorMessage:
        "Bluesky authorization could not be started.",
      lastErrorAt: new Date(),
    },
  });

  await prisma.blueskyOAuthStore.deleteMany({
    where: {
      clientId: options.clientId,
      connectionId: options.connectionId,
      kind: "state",
    },
  });
}

export async function createBlueskyOAuthState(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  identifier: unknown;
  returnPath?: unknown;
}): Promise<CreatedBlueskyOAuthState> {
  const prisma = requirePrisma();
  const identifier =
    normalizeBlueskyIdentifier(options.identifier);
  const returnPath =
    validateReturnPath(options.returnPath);

  const brand =
    await prisma.businessBrand.findFirst({
      where: {
        id: options.businessBrandId,
        status: {
          notIn: ["archived", "frozen"],
        },
      },
      select: {
        id: true,
        clientId: true,
      },
    });

  if (!brand) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found.",
      { status: 404 },
    );
  }

  /*
   * Resolve the workspace from the selected brand, then authorize the
   * authenticated profile against that workspace. This safely handles a
   * stale workspace cookie without trusting a clientId supplied by the browser.
   */
  const resolvedClientId = brand.clientId;

  await assertProfileCanManageSocialAccounts(
    prisma,
    {
      clientId: resolvedClientId,
      profileId: options.profileId,
    },
  );

  await assertClientCanConnectSocial(
    prisma,
    resolvedClientId,
    {
      provider: "bluesky",
      reconnect: false,
    },
  );

  if (
    !process.env.BLUESKY_OAUTH_PRIVATE_JWK?.trim()
  ) {
    throw new ServiceError(
      "unavailable",
      "Bluesky authorization is not configured.",
      { status: 503 },
    );
  }

  const connectionId =
    await runSocialDbTransaction(
      "bluesky-oauth-start-shell",
      (transaction) =>
        createConnectionShell(transaction, {
          clientId: resolvedClientId,
          profileId: options.profileId,
          businessBrandId: brand.id,
        }),
    );

  const publicState = createOAuthStateValue();
  const expiresAt = new Date(
    Date.now() +
      OAUTH_STATE_LIFETIME_MINUTES * 60 * 1000,
  );

  // SocialOAuthState requires encrypted verifier columns.
  // ATProto owns the real PKCE verifier inside the encrypted SDK store.
  const ownershipMarker = encryptSocialValue(
    "atproto-sdk-managed",
  );

  try {
    const client = await createBlueskyOAuthClient({
      clientId: resolvedClientId,
      connectionId,
    });

    const authorizationUrl = await client.authorize(
      identifier,
      {
        state: publicState,
        scope: "atproto transition:generic",
      },
    );

    if (
      authorizationUrl.protocol !== "https:"
    ) {
      throw new Error(
        "Bluesky returned an insecure authorization URL.",
      );
    }

    await runSocialDbTransaction(
      "bluesky-oauth-start-attempt",
      async (transaction) => {
        const connection =
          await transaction.socialProviderConnection.findFirst({
            where: {
              id: connectionId,
              clientId: resolvedClientId,
              businessBrandId: brand.id,
              provider: "bluesky",
              status: "pending_authorization",
            },
            select: {
              id: true,
            },
          });

        if (!connection) {
          throw new ServiceError(
            "conflict",
            "The Bluesky connection is no longer pending.",
            { status: 409 },
          );
        }

        await transaction.socialOAuthState.create({
          data: {
            clientId: resolvedClientId,
            businessBrandId: brand.id,
            connectionId,
            provider: "bluesky",
            status: "pending",
            stateHash:
              hashOAuthState(publicState),
            codeVerifierCiphertext:
              ownershipMarker.ciphertext,
            codeVerifierIv:
              ownershipMarker.iv,
            codeVerifierAuthTag:
              ownershipMarker.authTag,
            returnPath,
            expiresAt,
            createdByProfileId:
              options.profileId,
            metadata: {
              keyVersion:
                ownershipMarker.keyVersion,
              authorizationUrl:
                authorizationUrl.toString(),
              accountIdentifier: identifier,
              pkceOwner: "atproto_sdk",
            },
          },
        });

        await transaction.auditLog.create({
          data: {
            profileId: options.profileId,
            clientId: resolvedClientId,
            action:
              "social.connection.authorization_started",
            entityType:
              "social_provider_connection",
            entityId: connectionId,
            metadata: {
              provider: "bluesky",
              protocol: "atproto_oauth",
            },
          },
        });
      },
    );

    logSocialOAuthEvent(
      "bluesky-oauth-start",
      {
        stage: "attempt_created",
        outcome: "pending_redirect",
        provider: "bluesky",
        connectionId,
        mode: "start",
      },
    );

    return {
      authorizationUrl:
        authorizationUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      provider: "bluesky",
      connectionId,
      mode: "start",
    };
  } catch (error) {
    await markStartFailure({
      clientId: resolvedClientId,
      connectionId,
    });

    const oauthError = error as {
      name?: unknown;
      code?: unknown;
      cause?: unknown;
    };

    const errorName =
      typeof oauthError?.name === "string"
        ? oauthError.name
        : "UnknownError";

    const errorCode =
      typeof oauthError?.code === "string" &&
      /^[a-zA-Z0-9_.:-]{1,80}$/.test(oauthError.code)
        ? oauthError.code
        : null;

    const causeName =
      oauthError?.cause instanceof Error
        ? oauthError.cause.name
        : null;

    const errorCategory = [
      errorName,
      errorCode,
      causeName,
    ]
      .filter(Boolean)
      .join(":")
      .slice(0, 180);

    logSocialOAuthEvent(
      "bluesky-oauth-start",
      {
        stage: "authorization",
        outcome: "failed",
        provider: "bluesky",
        connectionId,
        mode: "start",
        errorCategory,
      },
    );

    if (error instanceof ServiceError) {
      throw error;
    }

    throw new ServiceError(
      "unavailable",
      "Bluesky could not find or authorize that handle.",
      { status: 503 },
    );
  }
}
