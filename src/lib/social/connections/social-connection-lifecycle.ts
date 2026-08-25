import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  canCancelPendingConnection,
  canDisconnectConnection,
  connectionMatchesProviderScope,
} from "@/lib/social/connections/social-connection-lifecycle-policy";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { disconnectSocialConnection } from "@/lib/social/connections/social-connection-management";
import {
  addAnotherSocialAccount,
  continueSocialAuthorization,
} from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export type CancelledPendingSocialConnection = {
  id: string;
  provider: string;
  status: "not_connected";
  businessBrandId: string;
  cancelledAt: string;
};

/**
 * Cancel a pending_authorization shell and restore Connect.
 *
 * Never mutates authorized/connected connections.
 * Never exposes tokens/state/codes.
 * Scoped to clientId + connectionId (+ optional provider).
 */
export async function cancelPendingSocialConnection(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  provider?: string;
}): Promise<CancelledPendingSocialConnection> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const cancelled = await runSocialDbTransaction(
    "social-oauth-cancel-pending",
    async (transaction) => {
    await assertProfileCanManageSocialAccounts(
      transaction,
      {
        clientId: options.clientId,
        profileId: options.profileId,
      },
    );

    const connection =
      await transaction.socialProviderConnection.findFirst({
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
        throw new ServiceError(
          "forbidden",
          scope.reason,
        );
      }
    }

    const decision = canCancelPendingConnection(
      connection.status,
    );

    if (!decision.allowed) {
      throw new ServiceError(
        "conflict",
        decision.reason,
      );
    }

    const cancelledAt = new Date();

    // Cancel unfinished OAuth attempts only (no secret material returned).
    await transaction.socialOAuthState.updateMany({
      where: {
        clientId: options.clientId,
        connectionId: connection.id,
        status: {
          in: ["pending", "processing"],
        },
      },
      data: {
        status: "cancelled",
        consumedAt: cancelledAt,
        errorMessage:
          "Pending authorization cancelled by the user.",
      },
    });

    // Pending shells should not hold usable credentials; remove any stray row
    // without touching SocialAccount history (there should be none selected).
    await transaction.socialCredential.deleteMany({
      where: {
        clientId: options.clientId,
        connectionId: connection.id,
      },
    });

    const updated =
      await transaction.socialProviderConnection.update({
        where: { id: connection.id },
        data: {
          status: "not_connected",
          authorizedAt: null,
          connectedAt: null,
          disconnectedAt: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          lastValidatedAt: null,
          lastSyncAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
        select: {
          id: true,
          provider: true,
          status: true,
          businessBrandId: true,
        },
      });

    await transaction.auditLog.create({
      data: {
        profileId: options.profileId,
        clientId: options.clientId,
        action: "social.connection.pending_cancelled",
        entityType: "social_provider_connection",
        entityId: connection.id,
        metadata: {
          provider: connection.provider,
          businessBrandId: connection.businessBrandId,
          previousStatus: connection.status,
          note:
            "Pending authorization cancelled; Connect restored. No authorized/connected account was modified.",
        },
      },
    });

    return {
      id: updated.id,
      provider: updated.provider,
      status: "not_connected" as const,
      businessBrandId: updated.businessBrandId,
      cancelledAt: cancelledAt.toISOString(),
    };
  },
  );

  logSocialOAuthEvent("social-oauth-cancel-pending", {
    stage: "cancel",
    outcome: "cancelled",
    provider: cancelled.provider,
    connectionId: cancelled.id,
  });

  return cancelled;
}

/**
 * Disconnect wrapper that enforces provider scope + lifecycle policy.
 */
export async function disconnectScopedSocialConnection(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  provider?: string;
}) {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

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
      throw new ServiceError(
        "forbidden",
        scope.reason,
      );
    }
  }

  const decision = canDisconnectConnection(
    connection.status,
  );

  if (!decision.allowed) {
    throw new ServiceError(
      "conflict",
      decision.reason,
    );
  }

  // Pending-only cancellations must use cancelPendingSocialConnection so
  // authorized/connected accounts are never affected by that path.
  if (connection.status === "pending_authorization") {
    throw new ServiceError(
      "conflict",
      "Use cancel-pending to abandon an unfinished authorization without disconnecting a live account.",
    );
  }

  return disconnectSocialConnection({
    clientId: options.clientId,
    profileId: options.profileId,
    connectionId: options.connectionId,
  });
}

export {
  continueSocialAuthorization,
  addAnotherSocialAccount,
};
