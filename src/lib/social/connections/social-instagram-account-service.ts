import "server-only";

import { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import {
  pickSelectedFacebookAccountStrict,
} from "@/lib/social/connections/social-canonical-identity";
import {
  runSocialDbTransaction,
  SOCIAL_DB_TRANSACTION_SELECTION_TIMEOUT_MS,
} from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { disconnectThreadsAccountsForConnection } from "@/lib/social/connections/social-threads-account-service";
import {
  fetchLinkedInstagramForFacebookPage,
  instagramConnectionEligible,
  MetaInstagramError,
  type MetaInstagramErrorCategory,
} from "@/lib/social/providers/meta-instagram";
import { hasRequiredMetaInstagramScopes } from "@/lib/social/providers/meta-token";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  readMetaFacebookPageCredential,
} from "@/lib/social/security/social-crypto";

export type ConnectInstagramResult = {
  connectionId: string;
  socialAccountId: string;
  displayName: string;
  handle: string | null;
  profileImageUrl: string | null;
  idempotent: boolean;
};

export type ClearInstagramResult = {
  connectionId: string;
  socialAccountId: string | null;
  displayName: string | null;
};

export function instagramErrorCategory(
  error: unknown,
): MetaInstagramErrorCategory | "conflict" | "forbidden" | "unavailable" {
  if (error instanceof MetaInstagramError) {
    return error.category;
  }

  if (error instanceof ServiceError) {
    if (error.code === "conflict") return "conflict";
    if (error.code === "forbidden") return "forbidden";
    if (error.code === "not_found") return "not_found";
    return "unavailable";
  }

  return "unavailable";
}

function decryptConnectionPayload(options: {
  clientId: string;
  connectionId: string;
  provider: string;
  credential: {
    encryptedPayload: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };
}) {
  try {
    return decryptSocialTokenPayload(
      {
        ciphertext: options.credential.encryptedPayload,
        iv: options.credential.iv,
        authTag: options.credential.authTag,
        keyVersion: options.credential.keyVersion,
      },
      buildSocialCredentialAad({
        clientId: options.clientId,
        connectionId: options.connectionId,
        provider: options.provider,
      }),
    );
  } catch {
    throw new MetaInstagramError(
      "authorization_expired",
      "Facebook authorization credentials could not be read. Reconnect to continue.",
      { status: 403 },
    );
  }
}

/**
 * Disconnect Instagram professional accounts on a Meta connection.
 * Does not touch Facebook Page selection or the Meta user token.
 */
export async function disconnectInstagramAccountsForConnection(options: {
  clientId: string;
  connectionId: string;
  transaction?: Prisma.TransactionClient;
}): Promise<void> {
  const run = async (db: Prisma.TransactionClient | ReturnType<typeof getPrisma>) => {
    if (!db) {
      return;
    }

    await db.socialAccount.updateMany({
      where: {
        clientId: options.clientId,
        providerConnectionId: options.connectionId,
        platform: "instagram",
        status: "connected",
      },
      data: {
        status: "not_connected",
        accessStatus: "available",
        businessBrandId: null,
      },
    });

    await disconnectThreadsAccountsForConnection({
      clientId: options.clientId,
      connectionId: options.connectionId,
      transaction: options.transaction,
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
 * Attach the Instagram professional account linked to the selected Facebook Page.
 * Instagram does not start OAuth; it reuses the Meta Page token.
 */
export async function connectLinkedInstagramAccount(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<ConnectInstagramResult> {
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
      provider: true,
      status: true,
      scopes: true,
      credential: {
        select: {
          id: true,
          status: true,
          encryptedPayload: true,
          iv: true,
          authTag: true,
          keyVersion: true,
        },
      },
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
      "Connect a Facebook Page first. Instagram is linked through that Page.",
    );
  }

  if (!connection.credential || connection.credential.status !== "active") {
    throw new ServiceError(
      "conflict",
      "Facebook authorization credentials are missing. Reconnect to continue.",
    );
  }

  const facebookAccounts = await prisma.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "facebook",
      accountType: "facebook_page",
    },
    select: {
      id: true,
      platform: true,
      status: true,
      accessStatus: true,
      displayName: true,
      handle: true,
      providerConnectionId: true,
      externalAccountId: true,
    },
    take: 20,
  });

  const selectedPage = pickSelectedFacebookAccountStrict(
    facebookAccounts,
    connection.id,
  );

  if (selectedPage.kind === "ambiguous") {
    throw new ServiceError(
      "conflict",
      "Multiple Facebook Page selections need attention. Confirm a single Page first.",
    );
  }

  if (
    selectedPage.kind === "missing" ||
    !selectedPage.account.externalAccountId
  ) {
    throw new ServiceError(
      "conflict",
      "Connect a Facebook Page first. Instagram is linked through that Page.",
    );
  }

  const existingInstagram = await prisma.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      providerConnectionId: connection.id,
      platform: "instagram",
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

  if (existingInstagram) {
    return {
      connectionId: connection.id,
      socialAccountId: existingInstagram.id,
      displayName:
        existingInstagram.displayName?.trim() ||
        existingInstagram.handle?.trim() ||
        "Instagram account",
      handle: existingInstagram.handle,
      profileImageUrl: existingInstagram.profileImageUrl,
      idempotent: true,
    };
  }

  const payload = decryptConnectionPayload({
    clientId: connection.clientId,
    connectionId: connection.id,
    provider: connection.provider,
    credential: connection.credential,
  });

  const grantedScopes = [
    ...connection.scopes,
    ...(payload.scopes ?? []),
  ];

  if (
    !hasRequiredMetaInstagramScopes(grantedScopes) &&
    !instagramConnectionEligible(grantedScopes)
  ) {
    throw new MetaInstagramError(
      "permission_required",
      "Instagram permissions are missing. Reconnect Facebook and grant Instagram access.",
      { status: 403 },
    );
  }

  const pageCredential = readMetaFacebookPageCredential(payload);

  if (
    !pageCredential?.accessToken ||
    pageCredential.pageId !== selectedPage.account.externalAccountId
  ) {
    throw new MetaInstagramError(
      "permission_required",
      "Facebook Page credentials are missing. Select the Page again, then connect Instagram.",
      { status: 403 },
    );
  }

  const discovered = await fetchLinkedInstagramForFacebookPage({
    pageAccessToken: pageCredential.accessToken,
    externalPageId: selectedPage.account.externalAccountId,
  });

  const displayName =
    discovered.displayName?.trim() ||
    discovered.handle?.trim() ||
    "Instagram account";

  const metadata = {
    source: "meta_page_instagram_business_account",
    linkedFacebookSocialAccountId: selectedPage.account.id,
  };

  try {
    const result = await runSocialDbTransaction(
      "instagram-account-select",
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
            "This Meta connection is no longer ready for Instagram setup.",
          );
        }

        const duplicate = await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            platform: "instagram",
            externalAccountId: discovered.externalAccountId,
            status: "connected",
            NOT: { providerConnectionId: connection.id },
          },
          select: { id: true },
        });

        if (duplicate) {
          throw new ServiceError(
            "conflict",
            "This Instagram account is already connected in this workspace.",
          );
        }

        const now = new Date();

        const existing = await transaction.socialAccount.findFirst({
          where: {
            providerConnectionId: connection.id,
            platform: "instagram",
            externalAccountId: discovered.externalAccountId,
          },
          select: { id: true },
        });

        const account = existing
          ? await transaction.socialAccount.update({
              where: { id: existing.id },
              data: {
                businessBrandId: fresh.businessBrandId,
                handle: discovered.handle,
                displayName,
                profileImageUrl: discovered.profileImageUrl,
                accountType: "instagram_professional",
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
                platform: "instagram",
                accountType: "instagram_professional",
                externalAccountId: discovered.externalAccountId,
                handle: discovered.handle,
                displayName,
                profileImageUrl: discovered.profileImageUrl,
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
            platform: "instagram",
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

    logSocialOAuthEvent("instagram-account-selection", {
      stage: "select_instagram",
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
      handle: discovered.handle,
      profileImageUrl: discovered.profileImageUrl,
      idempotent: false,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ServiceError(
        "conflict",
        "This Instagram account is already connected in this workspace.",
      );
    }

    throw error;
  }
}

export async function clearSelectedInstagramAccount(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
}): Promise<ClearInstagramResult> {
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
    select: { id: true, status: true },
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
      platform: "instagram",
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
      "There is no connected Instagram account to remove on this connection.",
    );
  }

  await runSocialDbTransaction(
    "instagram-account-clear",
    async (transaction) => {
      await assertProfileCanManageSocialAccounts(transaction, {
        clientId: options.clientId,
        profileId: options.profileId,
      });

      await disconnectInstagramAccountsForConnection({
        clientId: options.clientId,
        connectionId: connection.id,
        transaction,
      });
    },
  );

  logSocialOAuthEvent("instagram-account-selection", {
    stage: "clear_instagram",
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
