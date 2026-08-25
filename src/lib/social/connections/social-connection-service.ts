import "server-only";

import type {
  Prisma,
  SocialConnectionProvider,
} from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  createOAuthStateValue,
  createPkceChallenge,
  createPkceVerifier,
  decryptSocialValue,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
  encryptSocialValue,
  hashOAuthState,
  verifyOAuthStateHash,
  buildSocialCredentialAad,
  readMetaFacebookPageCredential,
  withMetaFacebookPageCredential,
  type SocialTokenPayload,
} from "@/lib/social/security/social-crypto";
import {
  getSocialProviderDefinition,
  getSocialProviderReadiness,
} from "@/lib/social/providers/registry";
import { buildMetaAuthorizationUrl } from "@/lib/social/providers/meta-oauth";
import type { SocialConnectionProviderValue } from "@/lib/social/providers/types";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  canAddAnotherAccount,
  canContinueAuthorization,
  canStartProviderConnect,
  connectionMatchesProviderScope,
  evaluateOAuthAttemptForContinue,
} from "@/lib/social/connections/social-connection-lifecycle-policy";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

const OAUTH_STATE_LIFETIME_MINUTES =
  10;

export type CreatedSocialOAuthState = {
  authorizationUrl: string;
  expiresAt: string;
  provider: SocialConnectionProviderValue;
  connectionId: string;
  /** resume = existing attempt; refresh = cancelled unusable + new attempt; created = brand-new shell */
  mode?: "resume" | "refresh" | "created" | "start";
};

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

function buildAuthorizationUrl(options: {
  provider: SocialConnectionProviderValue;
  state: string;
  codeChallenge: string;
}): string {
  if (options.provider === "meta") {
    return buildMetaAuthorizationUrl({
      state: options.state,
      codeChallenge: options.codeChallenge,
    });
  }

  throw new ServiceError(
    "unavailable",
    "This social provider cannot start authorization yet.",
    { status: 503 },
  );
}

function readAuthorizationUrlFromMetadata(
  metadata: Prisma.JsonValue | null | undefined,
): string | null {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return null;
  }

  const value = (
    metadata as Record<string, unknown>
  ).authorizationUrl;

  if (
    typeof value !== "string" ||
    !value.startsWith("https://")
  ) {
    return null;
  }

  return value;
}

function prepareOAuthAttemptMaterial(options: {
  provider: SocialConnectionProviderValue;
}): {
  publicState: string;
  encryptedVerifier: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };
  authorizationUrl: string;
  expiresAt: Date;
} {
  const publicState = createOAuthStateValue();
  const verifier = createPkceVerifier();
  const codeChallenge = createPkceChallenge(verifier);

  let encryptedVerifier: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };

  try {
    encryptedVerifier = encryptSocialValue(verifier);
  } catch {
    throw new ServiceError(
      "unavailable",
      "The social authorization request could not be prepared securely.",
    );
  }

  const authorizationUrl = buildAuthorizationUrl({
    provider: options.provider,
    state: publicState,
    codeChallenge,
  });

  const expiresAt = new Date(
    Date.now() +
      OAUTH_STATE_LIFETIME_MINUTES * 60 * 1000,
  );

  return {
    publicState,
    encryptedVerifier,
    authorizationUrl,
    expiresAt,
  };
}

type PrismaTransaction = Prisma.TransactionClient;

async function insertOAuthAttempt(
  transaction: PrismaTransaction,
  options: {
    clientId: string;
    businessBrandId: string;
    connectionId: string;
    provider: SocialConnectionProviderValue;
    profileId: string;
    returnPath: string;
    publicState: string;
    encryptedVerifier: {
      ciphertext: string;
      iv: string;
      authTag: string;
      keyVersion: number;
    };
    authorizationUrl: string;
    expiresAt: Date;
  },
) {
  await transaction.socialOAuthState.create({
    data: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      connectionId: options.connectionId,
      provider:
        options.provider as SocialConnectionProvider,
      status: "pending",
      stateHash: hashOAuthState(options.publicState),
      codeVerifierCiphertext:
        options.encryptedVerifier.ciphertext,
      codeVerifierIv: options.encryptedVerifier.iv,
      codeVerifierAuthTag:
        options.encryptedVerifier.authTag,
      returnPath: options.returnPath,
      expiresAt: options.expiresAt,
      createdByProfileId: options.profileId,
      metadata: {
        keyVersion:
          options.encryptedVerifier.keyVersion,
        // Public redirect destination only — never tokens or verifiers.
        authorizationUrl: options.authorizationUrl,
      },
    },
  });
}

function throwStartDecisionError(
  reason: string,
  label: string,
): never {
  if (reason === "coming_soon") {
    throw new ServiceError(
      "unavailable",
      `${label} authorization is not implemented yet.`,
      { status: 503 },
    );
  }

  if (reason === "not_configured") {
    throw new ServiceError(
      "unavailable",
      `${label} authorization is not configured.`,
      { status: 503 },
    );
  }

  if (reason === "pending_authorization") {
    throw new ServiceError(
      "conflict",
      "An authorization is already pending for this provider. Continue or cancel it before starting again.",
    );
  }

  if (reason === "already_connected") {
    throw new ServiceError(
      "conflict",
      "This brand is already connected. Disconnect or use Add another account to authorize again.",
    );
  }

  if (reason === "already_authorized") {
    throw new ServiceError(
      "conflict",
      "This provider is already authorized. Complete Page assignment, disconnect, or use Add another account.",
    );
  }

  throw new ServiceError(
    "unavailable",
    `${label} authorization is not available.`,
    { status: 503 },
  );
}

export async function createSocialOAuthState(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  provider: SocialConnectionProviderValue;
  returnPath: string;
}): Promise<CreatedSocialOAuthState> {
  const prisma = requirePrisma();

  await assertProfileCanManageSocialAccounts(
    prisma,
    {
      clientId: options.clientId,
      profileId: options.profileId,
    },
  );

  await assertClientCanConnectSocial(
    prisma,
    options.clientId,
  );

  const definition =
    getSocialProviderDefinition(
      options.provider,
    );

  const readiness =
    getSocialProviderReadiness(
      options.provider,
    );

  if (!definition.implemented) {
    throw new ServiceError(
      "unavailable",
      `${definition.label} authorization is not implemented yet.`,
      {
        status: 503,
      },
    );
  }

  if (!readiness.configured) {
    throw new ServiceError(
      "unavailable",
      `${definition.label} authorization is not configured.`,
      {
        status: 503,
      },
    );
  }

  if (!readiness.connectable) {
    throw new ServiceError(
      "unavailable",
      `${definition.label} authorization is not enabled yet.`,
      {
        status: 503,
      },
    );
  }

  const brand =
    await prisma.businessBrand.findFirst({
      where: {
        id: options.businessBrandId,
        clientId: options.clientId,
        status: {
          not: "archived",
        },
      },
      select: {
        id: true,
      },
    });

  if (!brand) {
    throw new ServiceError(
      "not_found",
      "The selected brand could not be found in this workspace.",
    );
  }

  const blockingConnection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        clientId: options.clientId,
        businessBrandId: brand.id,
        provider:
          options.provider as SocialConnectionProvider,
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

  const startDecision = canStartProviderConnect({
    implemented: definition.implemented,
    connectable: readiness.connectable,
    providerState: readiness.state,
    connectionStatus:
      blockingConnection?.status ?? null,
    isPrimaryStartCard: true,
  });

  if (!startDecision.allowed) {
    throwStartDecisionError(
      startDecision.reason,
      definition.label,
    );
  }

  const material = prepareOAuthAttemptMaterial({
    provider: options.provider,
  });

  const connection = await runSocialDbTransaction(
    "social-oauth-start",
    async (transaction) => {
      await transaction.$executeRaw`
        SELECT id
        FROM social_provider_connections
        WHERE "clientId" = ${options.clientId}::uuid
          AND "businessBrandId" = ${brand.id}::uuid
          AND provider = ${options.provider}::"SocialConnectionProvider"
        FOR UPDATE
      `;

      const currentBlocking =
        await transaction.socialProviderConnection.findFirst({
          where: {
            clientId: options.clientId,
            businessBrandId: brand.id,
            provider:
              options.provider as SocialConnectionProvider,
            status: {
              in: [...LIVE_OR_PENDING_STATUSES],
            },
          },
          select: {
            id: true,
            status: true,
          },
        });

      if (currentBlocking) {
        throwStartDecisionError(
          currentBlocking.status ===
            "pending_authorization"
            ? "pending_authorization"
            : currentBlocking.status === "connected"
              ? "already_connected"
              : "already_authorized",
          definition.label,
        );
      }

      const reusable =
        await transaction.socialProviderConnection.findFirst({
          where: {
            clientId: options.clientId,
            businessBrandId: brand.id,
            provider:
              options.provider as SocialConnectionProvider,
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

      const upserted = reusable
        ? await transaction.socialProviderConnection.update({
            where: { id: reusable.id },
            data: {
              status: "pending_authorization",
              connectedAt: null,
              authorizedAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastErrorAt: null,
              disconnectedAt: null,
              createdByProfileId: options.profileId,
            },
            select: {
              id: true,
              status: true,
            },
          })
        : await transaction.socialProviderConnection.create({
            data: {
              clientId: options.clientId,
              businessBrandId: brand.id,
              provider:
                options.provider as SocialConnectionProvider,
              status: "pending_authorization",
              createdByProfileId: options.profileId,
            },
            select: {
              id: true,
              status: true,
            },
          });

      if (upserted.status !== "pending_authorization") {
        throw new ServiceError(
          "conflict",
          "The social provider connection left an invalid early status.",
        );
      }

      await transaction.socialOAuthState.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: upserted.id,
          status: {
            in: ["pending", "processing"],
          },
        },
        data: {
          status: "cancelled",
          consumedAt: new Date(),
          errorMessage:
            "Superseded by a newer authorization attempt.",
        },
      });

      await insertOAuthAttempt(transaction, {
        clientId: options.clientId,
        businessBrandId: brand.id,
        connectionId: upserted.id,
        provider: options.provider,
        profileId: options.profileId,
        returnPath: options.returnPath,
        publicState: material.publicState,
        encryptedVerifier: material.encryptedVerifier,
        authorizationUrl: material.authorizationUrl,
        expiresAt: material.expiresAt,
      });

      return upserted;
    },
  );

  logSocialOAuthEvent("social-oauth-start", {
    stage: "attempt_created",
    outcome: "pending_redirect",
    provider: options.provider,
    connectionId: connection.id,
    mode: "start",
  });

  return {
    authorizationUrl: material.authorizationUrl,
    expiresAt: material.expiresAt.toISOString(),
    provider: options.provider,
    connectionId: connection.id,
    mode: "start",
  };
}

/**
 * Reauthorize the brand’s canonical Meta connection after token expiry.
 *
 * Preserves the canonical connection and selected Page assignment.
 * Only creates a pending OAuth attempt; does not disconnect, archive,
 * or replace the connection. Callers must not enqueue Page sync until
 * OAuth completes successfully.
 */
export async function startMetaFacebookReauthorization(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  returnPath: string;
}): Promise<{
  authorizationUrl: string;
  expiresAt: string;
  provider: "meta";
  mode: "reauthorization";
}> {
  const prisma = requirePrisma();

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  await assertClientCanConnectSocial(prisma, options.clientId);

  const readiness = getSocialProviderReadiness("meta");
  const definition = getSocialProviderDefinition("meta");

  if (!definition.implemented || !readiness.connectable) {
    throw new ServiceError(
      "unavailable",
      "Facebook reauthorization is not available.",
      { status: 503 },
    );
  }

  const { resolveCanonicalMetaConnectionForReauth } = await import(
    "@/lib/social/connections/facebook-dashboard-resolve"
  );

  const resolved = await resolveCanonicalMetaConnectionForReauth({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
  });

  if (resolved.kind === "ambiguous") {
    throw new ServiceError(
      "conflict",
      "Multiple Meta connections need attention. Open Manage connections to continue.",
    );
  }

  if (resolved.kind !== "ready") {
    throw new ServiceError(
      "not_found",
      "No Facebook connection is available to reconnect for this brand.",
    );
  }

  const material = prepareOAuthAttemptMaterial({ provider: "meta" });

  await runSocialDbTransaction(
    "social-oauth-reauth",
    async (transaction) => {
      await transaction.$executeRaw`
        SELECT id
        FROM social_provider_connections
        WHERE id = ${resolved.connectionId}::uuid
          AND "clientId" = ${options.clientId}::uuid
        FOR UPDATE
      `;

      const locked =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: resolved.connectionId,
            clientId: options.clientId,
            businessBrandId: options.businessBrandId,
            provider: "meta",
          },
          select: {
            id: true,
            status: true,
            businessBrandId: true,
          },
        });

      if (!locked) {
        throw new ServiceError(
          "not_found",
          "No Facebook connection is available to reconnect for this brand.",
        );
      }

      // Preserve status (typically connected) and selected Page rows.
      // Mark reauth pending via lastErrorCode only — never demote/disconnect.
      await transaction.socialProviderConnection.update({
        where: { id: locked.id },
        data: {
          lastErrorCode: "reauthorization_pending",
          lastErrorMessage:
            "Facebook authorization is being renewed. Finish reconnecting to continue.",
          lastErrorAt: new Date(),
          createdByProfileId: options.profileId,
        },
      });

      await transaction.socialOAuthState.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: locked.id,
          status: { in: ["pending", "processing"] },
        },
        data: {
          status: "cancelled",
          consumedAt: new Date(),
          errorMessage: "Superseded by Facebook reauthorization.",
        },
      });

      await insertOAuthAttempt(transaction, {
        clientId: options.clientId,
        businessBrandId: locked.businessBrandId,
        connectionId: locked.id,
        provider: "meta",
        profileId: options.profileId,
        returnPath: options.returnPath,
        publicState: material.publicState,
        encryptedVerifier: material.encryptedVerifier,
        authorizationUrl: material.authorizationUrl,
        expiresAt: material.expiresAt,
      });
    },
  );

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(options.clientId);

  logSocialOAuthEvent("social-oauth-reauth", {
    stage: "attempt_created",
    outcome: "pending_redirect",
    provider: "meta",
    mode: "reauthorization",
  });

  return {
    authorizationUrl: material.authorizationUrl,
    expiresAt: material.expiresAt.toISOString(),
    provider: "meta",
    mode: "reauthorization",
  };
}

/**
 * Abandon an unfinished Facebook reconnect without disconnecting the Page.
 * Clears reauthorization_pending and cancels pending/processing OAuth attempts.
 */
export async function cancelMetaFacebookReauthorization(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
}): Promise<{ cancelled: boolean }> {
  const prisma = requirePrisma();

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  const { resolveCanonicalMetaConnectionForReauth } = await import(
    "@/lib/social/connections/facebook-dashboard-resolve"
  );

  const resolved = await resolveCanonicalMetaConnectionForReauth({
    clientId: options.clientId,
    businessBrandId: options.businessBrandId,
  });

  if (resolved.kind !== "ready") {
    return { cancelled: false };
  }

  const now = new Date();
  await runSocialDbTransaction(
    "social-oauth-cancel-reauth",
    async (transaction) => {
      await transaction.socialOAuthState.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: resolved.connectionId,
          status: { in: ["pending", "processing"] },
        },
        data: {
          status: "cancelled",
          consumedAt: now,
          errorMessage: "Facebook reauthorization cancelled by the user.",
        },
      });

      await transaction.socialProviderConnection.updateMany({
        where: {
          id: resolved.connectionId,
          clientId: options.clientId,
          lastErrorCode: {
            in: [
              "reauthorization_pending",
              "reauthorization_failed",
            ],
          },
        },
        data: {
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });
    },
  );

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(options.clientId);

  logSocialOAuthEvent("social-oauth-reauth", {
    stage: "cancel",
    outcome: "cancelled",
    provider: "meta",
    mode: "reauthorization",
  });

  return { cancelled: true };
}

/**
 * Continue a pending authorization for the exact connection.
 * Resumes an unconsumed, unexpired attempt; otherwise cancels safely
 * and creates one fresh attempt. Concurrent callers serialize on the
 * connection row.
 */
export async function continueSocialAuthorization(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  provider?: string;
  returnPath?: string;
}): Promise<CreatedSocialOAuthState> {
  const prisma = requirePrisma();

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  await assertClientCanConnectSocial(
    prisma,
    options.clientId,
  );

  const connection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
      },
      select: {
        id: true,
        provider: true,
        status: true,
        businessBrandId: true,
      },
    });

  if (!connection) {
    throw new ServiceError(
      "not_found",
      "The selected social connection could not be found in this workspace.",
    );
  }

  if (options.provider) {
    const scope = connectionMatchesProviderScope({
      connectionProvider: connection.provider,
      expectedProvider: options.provider,
    });

    if (!scope.allowed) {
      throw new ServiceError("forbidden", scope.reason);
    }
  }

  const definition = getSocialProviderDefinition(
    connection.provider as SocialConnectionProviderValue,
  );
  const readiness = getSocialProviderReadiness(
    connection.provider as SocialConnectionProviderValue,
  );

  const continueDecision = canContinueAuthorization({
    implemented: definition.implemented,
    connectable: readiness.connectable,
    providerState: readiness.state,
    connectionStatus: connection.status,
    isPrimaryStartCard: true,
  });

  if (!continueDecision.allowed) {
    throw new ServiceError(
      continueDecision.reason === "coming_soon"
        ? "unavailable"
        : "conflict",
      continueDecision.reason === "coming_soon"
        ? `${definition.label} authorization is not implemented yet.`
        : continueDecision.reason,
      continueDecision.reason === "coming_soon"
        ? { status: 503 }
        : undefined,
    );
  }

  const returnPath =
    options.returnPath ?? "/dashboard/social?connections=open";

  type ContinuePlan =
    | {
        kind: "resume";
        authorizationUrl: string;
        expiresAt: string;
        provider: SocialConnectionProviderValue;
        connectionId: string;
      }
    | {
        kind: "refresh";
        provider: SocialConnectionProviderValue;
        connectionId: string;
        businessBrandId: string;
        refreshReason: string;
      };

  // Phase 1: short lock — decide resume vs refresh; cancel unusable attempts.
  // Crypto/network preparation stays outside.
  const plan = await runSocialDbTransaction(
    "social-oauth-continue-plan",
    async (transaction) => {
      await transaction.$executeRaw`
        SELECT id
        FROM social_provider_connections
        WHERE id = ${connection.id}::uuid
          AND "clientId" = ${options.clientId}::uuid
        FOR UPDATE
      `;

      const locked =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: connection.id,
            clientId: options.clientId,
          },
          select: {
            id: true,
            provider: true,
            status: true,
            businessBrandId: true,
          },
        });

      if (
        !locked ||
        locked.status !== "pending_authorization"
      ) {
        throw new ServiceError(
          "conflict",
          "Continue is only available for a pending authorization.",
        );
      }

      const latestAttempt =
        await transaction.socialOAuthState.findFirst({
          where: {
            clientId: options.clientId,
            connectionId: locked.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            consumedAt: true,
            metadata: true,
          },
        });

      const authorizationUrl =
        readAuthorizationUrlFromMetadata(
          latestAttempt?.metadata,
        );

      const attemptDecision = evaluateOAuthAttemptForContinue(
        latestAttempt
          ? {
              status: latestAttempt.status,
              expiresAt: latestAttempt.expiresAt,
              consumedAt: latestAttempt.consumedAt,
              hasAuthorizationUrl: authorizationUrl !== null,
            }
          : null,
      );

      if (attemptDecision.kind === "blocked") {
        throw new ServiceError(
          "conflict",
          "Authorization is already in progress for this connection. Wait a moment and try again.",
        );
      }

      if (
        attemptDecision.kind === "resume" &&
        authorizationUrl &&
        latestAttempt
      ) {
        return {
          kind: "resume",
          authorizationUrl,
          expiresAt: latestAttempt.expiresAt.toISOString(),
          provider:
            locked.provider as SocialConnectionProviderValue,
          connectionId: locked.id,
        } satisfies ContinuePlan;
      }

      await transaction.socialOAuthState.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: locked.id,
          status: {
            in: ["pending", "processing"],
          },
        },
        data: {
          status: "cancelled",
          consumedAt: new Date(),
          errorMessage:
            "Unusable pending attempt cancelled before Continue refresh.",
        },
      });

      return {
        kind: "refresh",
        provider:
          locked.provider as SocialConnectionProviderValue,
        connectionId: locked.id,
        businessBrandId: locked.businessBrandId,
        refreshReason:
          attemptDecision.kind === "refresh"
            ? attemptDecision.reason
            : "unusable",
      } satisfies ContinuePlan;
    },
  );

  if (plan.kind === "resume") {
    logSocialOAuthEvent("social-oauth-continue", {
      stage: "attempt",
      outcome: "resumed",
      provider: plan.provider,
      connectionId: plan.connectionId,
      mode: "resume",
    });

    return {
      authorizationUrl: plan.authorizationUrl,
      expiresAt: plan.expiresAt,
      provider: plan.provider,
      connectionId: plan.connectionId,
      mode: "resume",
    };
  }

  // Phase 2: prepare crypto/URL outside the interactive transaction.
  const material = prepareOAuthAttemptMaterial({
    provider: plan.provider,
  });

  const refreshed = await runSocialDbTransaction(
    "social-oauth-continue-refresh",
    async (transaction) => {
      await transaction.$executeRaw`
        SELECT id
        FROM social_provider_connections
        WHERE id = ${plan.connectionId}::uuid
          AND "clientId" = ${options.clientId}::uuid
        FOR UPDATE
      `;

      const locked =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: plan.connectionId,
            clientId: options.clientId,
          },
          select: {
            id: true,
            provider: true,
            status: true,
            businessBrandId: true,
          },
        });

      if (
        !locked ||
        locked.status !== "pending_authorization"
      ) {
        throw new ServiceError(
          "conflict",
          "Continue is only available for a pending authorization.",
        );
      }

      // A concurrent Continue may have already minted a usable attempt.
      const latestAttempt =
        await transaction.socialOAuthState.findFirst({
          where: {
            clientId: options.clientId,
            connectionId: locked.id,
            status: "pending",
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            status: true,
            expiresAt: true,
            consumedAt: true,
            metadata: true,
          },
        });

      const existingUrl =
        readAuthorizationUrlFromMetadata(
          latestAttempt?.metadata,
        );

      const decision = evaluateOAuthAttemptForContinue(
        latestAttempt
          ? {
              status: latestAttempt.status,
              expiresAt: latestAttempt.expiresAt,
              consumedAt: latestAttempt.consumedAt,
              hasAuthorizationUrl: existingUrl !== null,
            }
          : null,
      );

      if (
        decision.kind === "resume" &&
        existingUrl &&
        latestAttempt
      ) {
        return {
          authorizationUrl: existingUrl,
          expiresAt: latestAttempt.expiresAt.toISOString(),
          provider:
            locked.provider as SocialConnectionProviderValue,
          connectionId: locked.id,
          mode: "resume" as const,
        };
      }

      await transaction.socialOAuthState.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: locked.id,
          status: {
            in: ["pending", "processing"],
          },
        },
        data: {
          status: "cancelled",
          consumedAt: new Date(),
          errorMessage:
            "Unusable pending attempt cancelled before Continue refresh.",
        },
      });

      await insertOAuthAttempt(transaction, {
        clientId: options.clientId,
        businessBrandId: locked.businessBrandId,
        connectionId: locked.id,
        provider:
          locked.provider as SocialConnectionProviderValue,
        profileId: options.profileId,
        returnPath,
        publicState: material.publicState,
        encryptedVerifier: material.encryptedVerifier,
        authorizationUrl: material.authorizationUrl,
        expiresAt: material.expiresAt,
      });

      await transaction.auditLog.create({
        data: {
          profileId: options.profileId,
          clientId: options.clientId,
          action: "social.connection.continue_refreshed",
          entityType: "social_provider_connection",
          entityId: locked.id,
          metadata: {
            provider: locked.provider,
            businessBrandId: locked.businessBrandId,
            refreshReason: plan.refreshReason,
            note:
              "Expired or unusable OAuth attempt cancelled; one fresh attempt created. No authorized/connected account was modified.",
          },
        },
      });

      return {
        authorizationUrl: material.authorizationUrl,
        expiresAt: material.expiresAt.toISOString(),
        provider:
          locked.provider as SocialConnectionProviderValue,
        connectionId: locked.id,
        mode: "refresh" as const,
      };
    },
  );

  logSocialOAuthEvent("social-oauth-continue", {
    stage: "attempt",
    outcome:
      refreshed.mode === "resume" ? "resumed" : "refreshed",
    provider: refreshed.provider,
    connectionId: refreshed.connectionId,
    mode: refreshed.mode,
  });

  return refreshed;
}

/**
 * Create a separate pending connection for another account.
 * Never mutates the source authorized/connected connection.
 */
export async function addAnotherSocialAccount(options: {
  clientId: string;
  profileId: string;
  sourceConnectionId: string;
  provider?: string;
  returnPath: string;
}): Promise<CreatedSocialOAuthState> {
  const prisma = requirePrisma();

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  await assertClientCanConnectSocial(
    prisma,
    options.clientId,
  );

  const source =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.sourceConnectionId,
        clientId: options.clientId,
      },
      select: {
        id: true,
        provider: true,
        status: true,
        businessBrandId: true,
      },
    });

  if (!source) {
    throw new ServiceError(
      "not_found",
      "The selected social connection could not be found in this workspace.",
    );
  }

  if (options.provider) {
    const scope = connectionMatchesProviderScope({
      connectionProvider: source.provider,
      expectedProvider: options.provider,
    });

    if (!scope.allowed) {
      throw new ServiceError("forbidden", scope.reason);
    }
  }

  const definition = getSocialProviderDefinition(
    source.provider as SocialConnectionProviderValue,
  );
  const readiness = getSocialProviderReadiness(
    source.provider as SocialConnectionProviderValue,
  );

  const pendingForBrand =
    await prisma.socialProviderConnection.findFirst({
      where: {
        clientId: options.clientId,
        businessBrandId: source.businessBrandId,
        provider: source.provider,
        status: "pending_authorization",
      },
      select: { id: true },
    });

  const decision = canAddAnotherAccount({
    implemented: definition.implemented,
    connectable: readiness.connectable,
    providerState: readiness.state,
    supportsMultipleAccounts:
      definition.supportsMultipleAccounts,
    sourceConnectionStatus: source.status,
    isPrimaryStartCard: true,
    hasPendingForProviderBrand: pendingForBrand !== null,
  });

  if (!decision.allowed) {
    throw new ServiceError(
      decision.reason === "coming_soon" ||
        decision.reason === "unavailable" ||
        decision.reason === "not_configured"
        ? "unavailable"
        : "conflict",
      decision.reason === "coming_soon"
        ? `${definition.label} authorization is not implemented yet.`
        : decision.reason === "multiple_accounts_unsupported"
          ? `${definition.label} does not support adding another account yet.`
          : decision.reason,
      decision.reason === "coming_soon" ||
        decision.reason === "unavailable" ||
        decision.reason === "not_configured"
        ? { status: 503 }
        : undefined,
    );
  }

  const material = prepareOAuthAttemptMaterial({
    provider: source.provider as SocialConnectionProviderValue,
  });

  const created = await runSocialDbTransaction(
    "social-oauth-add-another",
    async (transaction) => {
    await transaction.$executeRaw`
      SELECT id
      FROM social_provider_connections
      WHERE "clientId" = ${options.clientId}::uuid
        AND "businessBrandId" = ${source.businessBrandId}::uuid
        AND provider = ${source.provider}::"SocialConnectionProvider"
      FOR UPDATE
    `;

    const sourceLocked =
      await transaction.socialProviderConnection.findFirst({
        where: {
          id: source.id,
          clientId: options.clientId,
        },
        select: {
          id: true,
          provider: true,
          status: true,
          businessBrandId: true,
        },
      });

    if (
      !sourceLocked ||
      (sourceLocked.status !== "authorized" &&
        sourceLocked.status !== "connected")
    ) {
      throw new ServiceError(
        "conflict",
        "Add another account is only available from an authorized or connected provider connection.",
      );
    }

    const existingPending =
      await transaction.socialProviderConnection.findFirst({
        where: {
          clientId: options.clientId,
          businessBrandId: sourceLocked.businessBrandId,
          provider: sourceLocked.provider,
          status: "pending_authorization",
        },
        select: { id: true },
      });

    if (existingPending) {
      throw new ServiceError(
        "conflict",
        "A pending authorization already exists for this provider. Continue or cancel it first.",
      );
    }

    // Create a NEW shell — never update the live source connection.
    const fresh =
      await transaction.socialProviderConnection.create({
        data: {
          clientId: options.clientId,
          businessBrandId: sourceLocked.businessBrandId,
          provider: sourceLocked.provider,
          status: "pending_authorization",
          createdByProfileId: options.profileId,
          metadata: {
            addedFromConnectionId: sourceLocked.id,
          },
        },
        select: {
          id: true,
          provider: true,
          businessBrandId: true,
        },
      });

    await insertOAuthAttempt(transaction, {
      clientId: options.clientId,
      businessBrandId: fresh.businessBrandId,
      connectionId: fresh.id,
      provider:
        fresh.provider as SocialConnectionProviderValue,
      profileId: options.profileId,
      returnPath: options.returnPath,
      publicState: material.publicState,
      encryptedVerifier: material.encryptedVerifier,
      authorizationUrl: material.authorizationUrl,
      expiresAt: material.expiresAt,
    });

    await transaction.auditLog.create({
      data: {
        profileId: options.profileId,
        clientId: options.clientId,
        action: "social.connection.add_another_started",
        entityType: "social_provider_connection",
        entityId: fresh.id,
        metadata: {
          provider: fresh.provider,
          businessBrandId: fresh.businessBrandId,
          sourceConnectionId: sourceLocked.id,
          sourceStatus: sourceLocked.status,
          note:
            "Separate pending connection created. Source authorized/connected connection was not modified.",
        },
      },
    });

    return fresh;
  },
  );

  logSocialOAuthEvent("social-oauth-add-another", {
    stage: "attempt_created",
    outcome: "pending_redirect",
    provider: created.provider,
    connectionId: created.id,
    mode: "created",
  });

  return {
    authorizationUrl: material.authorizationUrl,
    expiresAt: material.expiresAt.toISOString(),
    provider: created.provider as SocialConnectionProviderValue,
    connectionId: created.id,
    mode: "created",
  };
}

function readKeyVersion(
  metadata: Prisma.JsonValue | null,
): number {
  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return 1;
  }

  const value = (
    metadata as Record<
      string,
      unknown
    >
  ).keyVersion;

  return typeof value ===
      "number" &&
    Number.isInteger(value) &&
    value > 0
    ? value
    : 1;
}

export async function consumeSocialOAuthState(options: {
  provider: SocialConnectionProviderValue;
  state: string;
}): Promise<{
  oauthStateId: string;
  clientId: string;
  businessBrandId: string;
  connectionId: string;
  codeVerifier: string;
  returnPath: string;
}> {
  const prisma = requirePrisma();

  const stateHash =
    hashOAuthState(
      options.state,
    );

  const oauthState =
    await prisma.socialOAuthState.findUnique({
      where: {
        stateHash,
      },
      select: {
        id: true,
        clientId: true,
        businessBrandId: true,
        connectionId: true,
        provider: true,
        status: true,
        stateHash: true,
        codeVerifierCiphertext:
          true,
        codeVerifierIv: true,
        codeVerifierAuthTag:
          true,
        returnPath: true,
        expiresAt: true,
        metadata: true,
      },
    });

  if (
    !oauthState ||
    !verifyOAuthStateHash(
      options.state,
      oauthState.stateHash,
    )
  ) {
    throw new ServiceError(
      "forbidden",
      "The social authorization state is invalid.",
    );
  }

  if (
    oauthState.provider !==
    options.provider
  ) {
    throw new ServiceError(
      "forbidden",
      "The social authorization provider does not match the request.",
    );
  }

  if (
    oauthState.status !==
    "pending"
  ) {
    throw new ServiceError(
      "conflict",
      "This social authorization request has already been used.",
    );
  }

  if (
    oauthState.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.socialOAuthState.update({
      where: {
        id: oauthState.id,
      },
      data: {
        status: "expired",
      },
    });

    throw new ServiceError(
      "forbidden",
      "This social authorization request has expired.",
    );
  }

  if (!oauthState.connectionId) {
    throw new ServiceError(
      "conflict",
      "The social authorization request is missing its connection.",
    );
  }

  const keyVersion =
    readKeyVersion(
      oauthState.metadata,
    );

  const codeVerifier =
    decryptSocialValue({
      ciphertext:
        oauthState.codeVerifierCiphertext,
      iv: oauthState.codeVerifierIv,
      authTag:
        oauthState.codeVerifierAuthTag,
      keyVersion,
    });

  return {
    oauthStateId:
      oauthState.id,
    clientId:
      oauthState.clientId,
    businessBrandId:
      oauthState.businessBrandId,
    connectionId:
      oauthState.connectionId,
    codeVerifier,
    returnPath:
      oauthState.returnPath,
  };
}

export async function completeSocialOAuthState(options: {
  oauthStateId: string;
  connectionId: string;
  profileId: string;
  clientId?: string;
  provider?: string;
  externalSubjectId?: string | null;
  displayName?: string | null;
  scopes?: string[];
  tokenPayload: SocialTokenPayload;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
}): Promise<void> {
  const prisma = requirePrisma();

  const connection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.connectionId,
        ...(options.clientId
          ? { clientId: options.clientId }
          : {}),
      },
      select: {
        id: true,
        clientId: true,
        provider: true,
      },
    });

  if (!connection) {
    throw new ServiceError(
      "not_found",
      "The social provider connection could not be found.",
    );
  }

  const clientId = options.clientId ?? connection.clientId;
  const provider = options.provider ?? connection.provider;

  // Keep an existing Page access token across user-token refresh so analytics
  // sync does not lose Page credentials after reconnect.
  let tokenPayload: SocialTokenPayload = options.tokenPayload;
  const existingCredential =
    await prisma.socialCredential.findUnique({
      where: { connectionId: connection.id },
      select: {
        encryptedPayload: true,
        iv: true,
        authTag: true,
        keyVersion: true,
        status: true,
      },
    });

  if (existingCredential?.status === "active") {
    try {
      const previous = decryptSocialTokenPayload(
        {
          ciphertext: existingCredential.encryptedPayload,
          iv: existingCredential.iv,
          authTag: existingCredential.authTag,
          keyVersion: existingCredential.keyVersion,
        },
        buildSocialCredentialAad({
          clientId,
          connectionId: connection.id,
          provider,
        }),
      );
      const pageCredential = readMetaFacebookPageCredential(previous);
      if (pageCredential) {
        tokenPayload = withMetaFacebookPageCredential(tokenPayload, {
          pageId: pageCredential.pageId,
          accessToken: pageCredential.accessToken,
        });
      }
    } catch {
      // Fresh user token still stored; Page token can be reattached after.
    }
  }

  // Encryption preparation stays outside the interactive transaction.
  let encrypted: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };

  try {
    encrypted = encryptSocialTokenPayload(
      tokenPayload,
      buildSocialCredentialAad({
        clientId,
        connectionId: connection.id,
        provider,
      }),
    );
  } catch {
    throw new ServiceError(
      "unavailable",
      "The social credential could not be encrypted securely.",
    );
  }

  await runSocialDbTransaction(
    "social-oauth-complete",
    async (transaction) => {
      const oauthState =
        await transaction.socialOAuthState.findFirst({
          where: {
            id: options.oauthStateId,
            connectionId: options.connectionId,
            clientId,
            status: {
              in: ["pending", "processing"],
            },
          },
          select: {
            id: true,
            clientId: true,
          },
        });

      if (!oauthState) {
        throw new ServiceError(
          "conflict",
          "The social authorization request cannot be completed.",
        );
      }

      await assertProfileCanManageSocialAccounts(
        transaction,
        {
          clientId: oauthState.clientId,
          profileId: options.profileId,
        },
      );

      const lockedConnection =
        await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: oauthState.clientId,
          },
          select: {
            id: true,
            provider: true,
          },
        });

      if (!lockedConnection) {
        throw new ServiceError(
          "not_found",
          "The social provider connection could not be found.",
        );
      }

      const now = new Date();

      // One usable credential per connection: unique connectionId upsert.
      await transaction.socialCredential.upsert({
        where: {
          connectionId: options.connectionId,
        },
        update: {
          clientId: oauthState.clientId,
          status: "active",
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          tokenExpiresAt:
            options.accessTokenExpiresAt ?? null,
          refreshExpiresAt:
            options.refreshTokenExpiresAt ?? null,
          lastValidatedAt: now,
          statusChangedAt: now,
        },
        create: {
          clientId: oauthState.clientId,
          connectionId: options.connectionId,
          status: "active",
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          tokenExpiresAt:
            options.accessTokenExpiresAt ?? null,
          refreshExpiresAt:
            options.refreshTokenExpiresAt ?? null,
          lastValidatedAt: now,
          statusChangedAt: now,
        },
      });

      // Provider is authorized with Meta, but Page/account selection
      // has not finished — never mark connected here.
      await transaction.socialProviderConnection.update({
        where: {
          id: options.connectionId,
        },
        data: {
          status: "authorized",
          authorizedAt: now,
          externalSubjectId:
            options.externalSubjectId ?? null,
          displayName: options.displayName ?? null,
          scopes: options.scopes ?? [],
          accessTokenExpiresAt:
            options.accessTokenExpiresAt ?? null,
          refreshTokenExpiresAt:
            options.refreshTokenExpiresAt ?? null,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });

      await transaction.socialOAuthState.update({
        where: {
          id: oauthState.id,
        },
        data: {
          status: "completed",
          consumedAt: now,
        },
      });
    },
  );
}

export async function failSocialOAuthState(options: {
  oauthStateId: string;
  connectionId?: string | null;
  message: string;
}): Promise<void> {
  await runSocialDbTransaction(
    "social-oauth-fail",
    async (transaction) => {
      await transaction.socialOAuthState.updateMany({
        where: {
          id: options.oauthStateId,
          status: {
            in: ["pending", "processing"],
          },
        },
        data: {
          status: "failed",
          errorMessage: options.message.slice(0, 500),
          consumedAt: new Date(),
        },
      });

      if (options.connectionId) {
        await transaction.socialProviderConnection.updateMany({
          where: {
            id: options.connectionId,
          },
          data: {
            status: "failed",
            lastErrorCode: "oauth_failed",
            lastErrorMessage: options.message.slice(0, 500),
            lastErrorAt: new Date(),
          },
        });
      }
    },
  );
}
