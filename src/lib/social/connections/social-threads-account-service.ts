import "server-only";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { pickSelectedInstagramAccountStrict } from "@/lib/social/connections/social-canonical-identity";
import {
  runSocialDbTransaction,
  SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
} from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export type ConnectThreadsResult = {
  connectionId: string;
  socialAccountId: string;
  displayName: string;
  handle: string | null;
  profileImageUrl: string | null;
  idempotent: boolean;
};

export type ClearThreadsResult = {
  connectionId: string;
  socialAccountId: string | null;
  displayName: string | null;
};

/**
 * Disconnect Threads profiles on a Meta connection.
 * Does not touch Facebook Page or Instagram selection.
 */
export async function disconnectThreadsAccountsForConnection(options: {
  clientId: string;
  connectionId: string;
  transaction?: Prisma.TransactionClient;
}): Promise<void> {
  const run = async (
    db: Prisma.TransactionClient | ReturnType<typeof getPrisma>,
  ) => {
    if (!db) {
      return;
    }

    await db.socialAccount.updateMany({
      where: {
        clientId: options.clientId,
        providerConnectionId: options.connectionId,
        platform: "threads",
        status: "connected",
      },
      data: {
        status: "not_connected",
        accessStatus: "available",
        businessBrandId: null,
      },
    });
  };

  if (options.transaction) {
    await run(options.transaction);
    return;
  }

  const prisma = getPrisma();
  await run(prisma);
}

/**
 * Attach the Threads profile that belongs to the Instagram professional
 * account already linked to the selected Facebook Page.
 */
export async function connectLinkedThreadsAccount(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<ConnectThreadsResult> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: options.clientId,
    profileId: options.profileId,
  });

  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "meta",
    },
    select: {
      id: true,
      clientId: true,
      businessBrandId: true,
      status: true,
    },
  });

  if (!connection) {
    throw new ServiceError(
      "not_found",
      "The social connection could not be found.",
    );
  }

  if (connection.status !== "connected") {
    throw new ServiceError(
      "conflict",
      "Connect a Facebook Page first. Threads is linked through that Meta account.",
    );
  }

  const instagramAccounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "instagram",
      accountType: "instagram_professional",
    },
    select: {
      id: true,
      platform: true,
      status: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      profileImageUrl: true,
      providerConnectionId: true,
      externalAccountId: true,
    },
    take: 20,
  });

  const selectedInstagram = pickSelectedInstagramAccountStrict(
    instagramAccounts,
    connection.id,
  );

  if (selectedInstagram.kind === "ambiguous") {
    throw new ServiceError(
      "conflict",
      "Multiple Instagram selections need attention. Confirm a single Instagram account first.",
    );
  }

  if (
    selectedInstagram.kind === "missing" ||
    !selectedInstagram.account.externalAccountId
  ) {
    throw new ServiceError(
      "conflict",
      "Connect Instagram from Facebook first. Threads is linked through that Instagram professional account.",
    );
  }

  const instagram = selectedInstagram.account;
  const externalAccountId = `threads-from-ig:${instagram.externalAccountId}`;
  const displayName =
    instagram.displayName?.trim() ||
    instagram.handle?.trim() ||
    "Threads account";

  const existingThreads = await prisma.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "threads",
      status: "connected",
      accessStatus: "selected",
    },
    select: {
      id: true,
      displayName: true,
      handle: true,
      profileImageUrl: true,
    },
  });

  if (existingThreads) {
    return {
      connectionId: connection.id,
      socialAccountId: existingThreads.id,
      displayName:
        existingThreads.displayName?.trim() ||
        existingThreads.handle?.trim() ||
        "Threads account",
      handle: existingThreads.handle,
      profileImageUrl: existingThreads.profileImageUrl,
      idempotent: true,
    };
  }

  const metadata = {
    source: "meta_instagram_threads_profile",
    linkedInstagramSocialAccountId: instagram.id,
  };

  try {
    const result = await runSocialDbTransaction(
      "threads-account-select",
      async (transaction) => {
        await assertProfileCanManageSocialAccounts(transaction, {
          clientId: options.clientId,
          profileId: options.profileId,
        });

        const fresh = await transaction.socialProviderConnection.findFirst({
          where: {
            id: connection.id,
            clientId: options.clientId,
            provider: "meta",
            status: "connected",
          },
          select: { id: true, businessBrandId: true },
        });

        if (!fresh) {
          throw new ServiceError(
            "conflict",
            "This Meta connection is no longer ready for Threads setup.",
          );
        }

        const duplicate = await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            platform: "threads",
            externalAccountId,
            status: "connected",
            NOT: { providerConnectionId: connection.id },
          },
          select: { id: true },
        });

        if (duplicate) {
          throw new ServiceError(
            "conflict",
            "This Threads account is already connected in this workspace.",
          );
        }

        const now = new Date();
        const existing = await transaction.socialAccount.findFirst({
          where: {
            providerConnectionId: connection.id,
            platform: "threads",
            externalAccountId,
          },
          select: { id: true },
        });

        const account = existing
          ? await transaction.socialAccount.update({
              where: { id: existing.id },
              data: {
                businessBrandId: fresh.businessBrandId,
                handle: instagram.handle,
                displayName,
                profileImageUrl: instagram.profileImageUrl,
                accountType: "threads_profile",
                status: "connected",
                accessStatus: "selected",
                isAvailableThroughAuth: true,
                lastDiscoveredAt: now,
                metadata,
              },
              select: { id: true },
            })
          : await transaction.socialAccount.create({
              data: {
                clientId: options.clientId,
                businessBrandId: fresh.businessBrandId,
                providerConnectionId: connection.id,
                platform: "threads",
                accountType: "threads_profile",
                externalAccountId,
                handle: instagram.handle,
                displayName,
                profileImageUrl: instagram.profileImageUrl,
                status: "connected",
                accessStatus: "selected",
                isAvailableThroughAuth: true,
                firstDiscoveredAt: now,
                lastDiscoveredAt: now,
                metadata,
              },
              select: { id: true },
            });

        await transaction.socialAccount.updateMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "threads",
            status: "connected",
            NOT: { id: account.id },
          },
          data: {
            status: "not_connected",
            accessStatus: "available",
            businessBrandId: null,
          },
        });

        return { socialAccountId: account.id };
      },
      {
        maxWaitMs: SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
        timeoutMs: SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
      },
    );

    logSocialOAuthEvent("threads-account-selection", {
      stage: "select_threads",
      outcome: "ok",
      provider: "meta",
      connectionId: connection.id,
    });

    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(options.clientId);

    return {
      connectionId: connection.id,
      socialAccountId: result.socialAccountId,
      displayName,
      handle: instagram.handle,
      profileImageUrl: instagram.profileImageUrl,
      idempotent: false,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError(
        "conflict",
        "This Threads account is already connected in this workspace.",
      );
    }

    throw error;
  }
}

export async function clearSelectedThreadsAccount(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<ClearThreadsResult> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "meta",
    },
    select: { id: true },
  });

  if (!connection) {
    throw new ServiceError(
      "not_found",
      "The social connection could not be found.",
    );
  }

  const selected = await prisma.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "threads",
      status: "connected",
    },
    select: {
      id: true,
      displayName: true,
      handle: true,
    },
  });

  if (!selected) {
    throw new ServiceError(
      "conflict",
      "There is no connected Threads account to remove on this connection.",
    );
  }

  await runSocialDbTransaction("threads-account-clear", async (transaction) => {
    await assertProfileCanManageSocialAccounts(transaction, {
      clientId: options.clientId,
      profileId: options.profileId,
    });

    await disconnectThreadsAccountsForConnection({
      clientId: options.clientId,
      connectionId: connection.id,
      transaction,
    });
  });

  logSocialOAuthEvent("threads-account-selection", {
    stage: "clear_threads",
    outcome: "ok",
    provider: "meta",
    connectionId: connection.id,
  });

  const { invalidateBrandSelectorCache } = await import(
    "@/lib/security/brand-context"
  );
  invalidateBrandSelectorCache(options.clientId);

  return {
    connectionId: connection.id,
    socialAccountId: selected.id,
    displayName: selected.displayName ?? selected.handle,
  };
}
