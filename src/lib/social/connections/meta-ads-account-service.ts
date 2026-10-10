import "server-only";

import { Prisma } from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  runSocialDbTransaction,
  SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
} from "@/lib/social/connections/social-db-transaction";
import type { MetaAdAccountRecord } from "@/lib/social/providers/meta-ads-accounts";

const ALREADY_CONNECTED =
  "This Meta ad account is already connected in this workspace.";

function metadataFor(account: MetaAdAccountRecord): Prisma.InputJsonValue {
  return {
    source: "meta_ads",
    currency: account.currency,
    timezone: account.timezone,
    accountStatus: account.accountStatus,
  };
}

async function assertAdAccountIsFree(
  transaction: Prisma.TransactionClient,
  options: {
    clientId: string;
    connectionId: string;
    externalAccountId: string;
  },
): Promise<void> {
  const duplicate = await transaction.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      platform: "meta_ads",
      externalAccountId: options.externalAccountId,
      status: "connected",
      NOT: { providerConnectionId: options.connectionId },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ServiceError("conflict", ALREADY_CONNECTED);
  }
}

async function selectStoredAdAccount(
  transaction: Prisma.TransactionClient,
  options: {
    clientId: string;
    connectionId: string;
    businessBrandId: string;
    socialAccountId: string;
    externalAccountId: string;
    displayName: string;
    currency: string;
    timezone: string;
  },
): Promise<void> {
  const now = new Date();

  await transaction.socialAccount.updateMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "meta_ads",
      status: "connected",
      NOT: { id: options.socialAccountId },
    },
    data: {
      status: "not_connected",
      accessStatus: "available",
    },
  });

  await transaction.socialAccount.update({
    where: { id: options.socialAccountId },
    data: {
      businessBrandId: options.businessBrandId,
      displayName: options.displayName,
      status: "connected",
      accessStatus: "selected",
      isAvailableThroughAuth: true,
      lastDiscoveredAt: now,
    },
  });

  await transaction.socialAdAccount.updateMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "meta_ads",
      NOT: { externalAccountId: options.externalAccountId },
    },
    data: { status: "not_connected" },
  });

  await transaction.socialAdAccount.upsert({
    where: {
      clientId_businessBrandId_platform_externalAccountId: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        platform: "meta_ads",
        externalAccountId: options.externalAccountId,
      },
    },
    update: {
      providerConnectionId: options.connectionId,
      displayName: options.displayName,
      currency: options.currency,
      timezone: options.timezone,
      status: "connected",
    },
    create: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      providerConnectionId: options.connectionId,
      platform: "meta_ads",
      externalAccountId: options.externalAccountId,
      displayName: options.displayName,
      currency: options.currency,
      timezone: options.timezone,
      status: "connected",
    },
  });

  await transaction.socialProviderConnection.update({
    where: { id: options.connectionId },
    data: {
      status: "connected",
      connectedAt: now,
      displayName: options.displayName,
      lastValidatedAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorAt: null,
    },
  });
}

export async function syncDiscoveredMetaAdAccounts(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  accounts: MetaAdAccountRecord[];
}): Promise<{ selected: boolean }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  try {
    return await runSocialDbTransaction(
      "meta-ads-account-discover",
      async (transaction) => {
        await assertProfileCanManageSocialAccounts(transaction, {
          clientId: options.clientId,
          profileId: options.profileId,
        });

        const connection = await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
            provider: "meta_ads",
          },
          select: { id: true, businessBrandId: true },
        });

        if (!connection) {
          throw new ServiceError(
            "not_found",
            "The Meta Ads connection could not be found.",
          );
        }

        await assertClientCanConnectSocial(transaction, options.clientId, {
          provider: "meta_ads",
          reconnect: true,
        });

        const previouslySelected = await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "meta_ads",
            status: "connected",
            accessStatus: "selected",
          },
          select: { externalAccountId: true },
        });

        const now = new Date();
        const discoveredIds = options.accounts.map(
          (account) => account.externalAccountId,
        );

        for (const account of options.accounts) {
          await transaction.socialAccount.upsert({
            where: {
              providerConnectionId_platform_externalAccountId: {
                providerConnectionId: connection.id,
                platform: "meta_ads",
                externalAccountId: account.externalAccountId,
              },
            },
            update: {
              businessBrandId: connection.businessBrandId,
              displayName: account.displayName,
              handle: null,
              accountType: "meta_ad_account",
              status: "pending_connection",
              accessStatus: "available",
              isAvailableThroughAuth: true,
              lastDiscoveredAt: now,
              metadata: metadataFor(account),
            },
            create: {
              clientId: options.clientId,
              businessBrandId: connection.businessBrandId,
              providerConnectionId: connection.id,
              platform: "meta_ads",
              accountType: "meta_ad_account",
              externalAccountId: account.externalAccountId,
              displayName: account.displayName,
              status: "pending_connection",
              accessStatus: "available",
              isAvailableThroughAuth: true,
              firstDiscoveredAt: now,
              lastDiscoveredAt: now,
              metadata: metadataFor(account),
            },
          });
        }

        await transaction.socialAccount.updateMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "meta_ads",
            ...(discoveredIds.length > 0
              ? { externalAccountId: { notIn: discoveredIds } }
              : {}),
          },
          data: {
            status: "not_connected",
            accessStatus: "removed",
            isAvailableThroughAuth: false,
          },
        });

        if (discoveredIds.length === 0) {
          await transaction.socialAdAccount.updateMany({
            where: {
              clientId: options.clientId,
              providerConnectionId: connection.id,
              platform: "meta_ads",
            },
            data: { status: "not_connected" },
          });
          return { selected: false };
        }

        const stored = await transaction.socialAccount.findMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "meta_ads",
            isAvailableThroughAuth: true,
            externalAccountId: { in: discoveredIds },
          },
          select: {
            id: true,
            externalAccountId: true,
            displayName: true,
            metadata: true,
          },
        });

        const single = stored.length === 1 ? stored[0] : null;
        const previous = previouslySelected?.externalAccountId
          ? stored.find(
              (account) =>
                account.externalAccountId ===
                previouslySelected.externalAccountId,
            )
          : null;
        const chosen = single ?? previous ?? null;
        if (!chosen?.externalAccountId) {
          return { selected: false };
        }

        const match = options.accounts.find(
          (account) => account.externalAccountId === chosen.externalAccountId,
        );
        if (!match) {
          return { selected: false };
        }

        await assertAdAccountIsFree(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          externalAccountId: chosen.externalAccountId,
        });

        await selectStoredAdAccount(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          businessBrandId: connection.businessBrandId,
          socialAccountId: chosen.id,
          externalAccountId: chosen.externalAccountId,
          displayName: match.displayName,
          currency: match.currency,
          timezone: match.timezone,
        });

        return { selected: true };
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError("conflict", ALREADY_CONNECTED);
    }
    throw error;
  }
}

export async function selectMetaAdAccount(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
}): Promise<{ displayName: string }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  try {
    return await runSocialDbTransaction(
      "meta-ads-account-select",
      async (transaction) => {
        await assertProfileCanManageSocialAccounts(transaction, {
          clientId: options.clientId,
          profileId: options.profileId,
        });

        const connection = await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
            provider: "meta_ads",
            status: { in: ["authorized", "connected"] },
          },
          select: { id: true, businessBrandId: true },
        });

        if (!connection) {
          throw new ServiceError(
            "not_found",
            "The Meta Ads connection could not be found.",
          );
        }

        const account = await transaction.socialAccount.findFirst({
          where: {
            id: options.socialAccountId,
            clientId: options.clientId,
            providerConnectionId: connection.id,
            businessBrandId: connection.businessBrandId,
            platform: "meta_ads",
            isAvailableThroughAuth: true,
            status: { in: ["pending_connection", "connected"] },
          },
          select: {
            id: true,
            externalAccountId: true,
            displayName: true,
            metadata: true,
            status: true,
          },
        });

        if (!account?.externalAccountId) {
          throw new ServiceError(
            "not_found",
            "Choose a Meta ad account from this connection.",
          );
        }

        await assertClientCanConnectSocial(transaction, options.clientId, {
          provider: "meta_ads",
          reconnect: account.status === "connected",
        });

        await assertAdAccountIsFree(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          externalAccountId: account.externalAccountId,
        });

        const metadata =
          typeof account.metadata === "object" &&
          account.metadata !== null &&
          !Array.isArray(account.metadata)
            ? (account.metadata as Record<string, unknown>)
            : {};
        const currency =
          typeof metadata.currency === "string" &&
          /^[A-Z]{3}$/.test(metadata.currency)
            ? metadata.currency
            : "CAD";
        const timezone =
          typeof metadata.timezone === "string" &&
          /^[A-Za-z0-9_/+-]{1,64}$/.test(metadata.timezone)
            ? metadata.timezone
            : "UTC";
        const displayName = account.displayName?.trim() || "Meta ad account";

        await selectStoredAdAccount(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          businessBrandId: connection.businessBrandId,
          socialAccountId: account.id,
          externalAccountId: account.externalAccountId,
          displayName,
          currency,
          timezone,
        });

        return { displayName };
      },
      {
        maxWaitMs: SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
        timeoutMs: SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError("conflict", ALREADY_CONNECTED);
    }
    throw error;
  }
}
