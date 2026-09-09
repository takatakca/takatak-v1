import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import type { YoutubeChannelRecord } from "@/lib/social/providers/google-youtube";
import { Prisma } from "@prisma/client";

export type YoutubeChannelSelection = {
  connectionId: string;
  socialAccountId: string;
  displayName: string;
  handle: string | null;
  profileImageUrl: string | null;
  idempotent: boolean;
};

export type StoredYoutubeChannel = {
  socialAccountId: string;
  displayName: string;
  handle: string | null;
  profileImageUrl: string | null;
  selected: boolean;
};

async function requireGoogleConnection(options: {
  clientId: string;
  connectionId: string;
  transaction: Prisma.TransactionClient;
}) {
  const connection = await options.transaction.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "google",
    },
    select: {
      id: true,
      businessBrandId: true,
      status: true,
    },
  });

  if (!connection) {
    throw new ServiceError(
      "not_found",
      "The Google connection could not be found.",
    );
  }

  return connection;
}

export async function persistDiscoveredYoutubeChannels(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  channels: YoutubeChannelRecord[];
}): Promise<{ selected: YoutubeChannelSelection | null; storedCount: number }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const autoSelect = options.channels.length === 1;

  const selected = await runSocialDbTransaction(
    "youtube-channel-discover",
    async (transaction) => {
    let chosen: YoutubeChannelSelection | null = null;
    await assertProfileCanManageSocialAccounts(transaction, {
      clientId: options.clientId,
      profileId: options.profileId,
    });

    const connection = await requireGoogleConnection({
      clientId: options.clientId,
      connectionId: options.connectionId,
      transaction,
    });

    const now = new Date();
    const seenIds = new Set<string>();

    for (const channel of options.channels) {
      seenIds.add(channel.externalAccountId);
      const existing = await transaction.socialAccount.findFirst({
        where: {
          providerConnectionId: connection.id,
          platform: "youtube",
          externalAccountId: channel.externalAccountId,
        },
        select: { id: true, status: true, accessStatus: true },
      });

      const shouldSelect = autoSelect;
      const data = {
        businessBrandId: shouldSelect ? connection.businessBrandId : null,
        handle: channel.handle,
        displayName: channel.displayName,
        profileImageUrl: channel.profileImageUrl,
        accountType: "youtube_channel",
        status: shouldSelect ? "connected" : "not_connected",
        accessStatus: shouldSelect ? "selected" : "available",
        isAvailableThroughAuth: true,
        lastDiscoveredAt: now,
        metadata: { source: "google_youtube_mine" },
      } as const;

      const account = existing
        ? await transaction.socialAccount.update({
            where: { id: existing.id },
            data,
            select: { id: true },
          })
        : await transaction.socialAccount.create({
            data: {
              clientId: options.clientId,
              providerConnectionId: connection.id,
              platform: "youtube",
              externalAccountId: channel.externalAccountId,
              firstDiscoveredAt: now,
              ...data,
            },
            select: { id: true },
          });

      if (shouldSelect) {
        chosen = {
          connectionId: connection.id,
          socialAccountId: account.id,
          displayName: channel.displayName,
          handle: channel.handle,
          profileImageUrl: channel.profileImageUrl,
          idempotent: existing?.status === "connected",
        };
      }
    }

    await transaction.socialAccount.updateMany({
      where: {
        clientId: options.clientId,
        providerConnectionId: connection.id,
        platform: "youtube",
        status: "connected",
        ...(seenIds.size > 0
          ? { NOT: { externalAccountId: { in: [...seenIds] } } }
          : {}),
      },
      data: {
        status: "not_connected",
        accessStatus: "removed",
        isAvailableThroughAuth: false,
        businessBrandId: null,
      },
    });

    if (chosen) {
      await transaction.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId: connection.id,
          platform: "youtube",
          status: "connected",
          NOT: { id: chosen.socialAccountId },
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
          displayName: chosen.displayName,
          lastValidatedAt: now,
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });
    }

    return chosen;
    },
  );

  logSocialOAuthEvent("youtube-channel-selection", {
    stage: "discover",
    outcome: selected ? "selected" : "available",
    provider: "google",
  });

  return { selected, storedCount: options.channels.length };
}

export async function listStoredYoutubeChannels(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<StoredYoutubeChannel[]> {
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
      provider: "google",
    },
    select: { id: true },
  });

  if (!connection) {
    throw new ServiceError(
      "not_found",
      "The Google connection could not be found.",
    );
  }

  const accounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "youtube",
      isAvailableThroughAuth: true,
    },
    select: {
      id: true,
      displayName: true,
      handle: true,
      profileImageUrl: true,
      status: true,
      accessStatus: true,
    },
    orderBy: { displayName: "asc" },
  });

  return accounts.map((account) => ({
    socialAccountId: account.id,
    displayName: account.displayName ?? "YouTube channel",
    handle: account.handle,
    profileImageUrl: account.profileImageUrl,
    selected:
      account.status === "connected" && account.accessStatus === "selected",
  }));
}

export async function selectYoutubeChannel(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
}): Promise<YoutubeChannelSelection> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const selection = await runSocialDbTransaction(
    "youtube-channel-select",
    async (transaction) => {
    await assertProfileCanManageSocialAccounts(transaction, {
      clientId: options.clientId,
      profileId: options.profileId,
    });

    const connection = await requireGoogleConnection({
      clientId: options.clientId,
      connectionId: options.connectionId,
      transaction,
    });

    const account = await transaction.socialAccount.findFirst({
      where: {
        id: options.socialAccountId,
        clientId: options.clientId,
        providerConnectionId: connection.id,
        platform: "youtube",
      },
      select: {
        id: true,
        displayName: true,
        handle: true,
        profileImageUrl: true,
        status: true,
        accessStatus: true,
        externalAccountId: true,
      },
    });

    if (!account || !account.externalAccountId) {
      throw new ServiceError(
        "not_found",
        "Select a YouTube channel to continue setup.",
      );
    }

    const duplicate = await transaction.socialAccount.findFirst({
      where: {
        clientId: options.clientId,
        platform: "youtube",
        externalAccountId: account.externalAccountId,
        status: "connected",
        NOT: { providerConnectionId: connection.id },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ServiceError(
        "conflict",
        "This YouTube channel is already connected in this workspace.",
      );
    }

    const now = new Date();
    const displayName = account.displayName?.trim() || "YouTube channel";
    const alreadySelected =
      account.status === "connected" && account.accessStatus === "selected";

    await transaction.socialAccount.updateMany({
      where: {
        clientId: options.clientId,
        providerConnectionId: connection.id,
        platform: "youtube",
        status: "connected",
        NOT: { id: account.id },
      },
      data: {
        status: "not_connected",
        accessStatus: "available",
        businessBrandId: null,
      },
    });

    await transaction.socialAccount.update({
      where: { id: account.id },
      data: {
        businessBrandId: connection.businessBrandId,
        displayName,
        status: "connected",
        accessStatus: "selected",
        isAvailableThroughAuth: true,
        lastDiscoveredAt: now,
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

    return {
      connectionId: connection.id,
      socialAccountId: account.id,
      displayName,
      handle: account.handle,
      profileImageUrl: account.profileImageUrl,
      idempotent: alreadySelected,
    };
    },
  );

  if (!selection) {
    throw new ServiceError(
      "unavailable",
      "The YouTube channel could not be selected.",
    );
  }

  logSocialOAuthEvent("youtube-channel-selection", {
    stage: "select",
    outcome: "ok",
    provider: "google",
  });

  return selection;
}
