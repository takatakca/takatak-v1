import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";

export type SocialConnectionAccountSummary = {
  id: string;
  platform: string;
  externalAccountId: string | null;
  handle: string | null;
  displayName: string | null;
  status: string;
  accessStatus: string;
  profileImageUrl: string | null;
};

export type SocialConnectionSummary = {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  externalSubjectId: string | null;
  scopes: string[];
  brandId: string;
  brandName: string;
  brandStatus: string;
  hasCredential: boolean;
  accountCount: number;
  accounts: SocialConnectionAccountSummary[];
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastValidatedAt: string | null;
  lastSyncAt: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getSocialConnectionsData(
  clientId: string,
  businessBrandId?: string | null,
): Promise<SocialConnectionSummary[]> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  const connections =
    await prisma.socialProviderConnection.findMany({
      where: {
        clientId,

        ...(businessBrandId
          ? {
              businessBrandId,
            }
          : {}),
      },

      select: {
        id: true,
        provider: true,
        status: true,
        displayName: true,
        externalSubjectId: true,
        scopes: true,
        connectedAt: true,
        disconnectedAt: true,
        lastValidatedAt: true,
        lastSyncAt: true,
        accessTokenExpiresAt: true,
        refreshTokenExpiresAt: true,
        lastErrorCode: true,
        lastErrorMessage: true,
        createdAt: true,
        updatedAt: true,

        businessBrand: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },

        credential: {
          select: {
            id: true,
          },
        },

        socialAccounts: {
          orderBy: [
            {
              platform: "asc",
            },
            {
              displayName: "asc",
            },
          ],

          select: {
            id: true,
            platform: true,
            externalAccountId: true,
            handle: true,
            displayName: true,
            status: true,
            accessStatus: true,
            profileImageUrl: true,
          },
        },
      },

      orderBy: [
        {
          businessBrand: {
            name: "asc",
          },
        },
        {
          provider: "asc",
        },
      ],
    });

  return connections.map(
    (connection) => ({
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      displayName:
        connection.displayName,
      externalSubjectId:
        connection.externalSubjectId,
      scopes: connection.scopes,
      brandId:
        connection.businessBrand.id,
      brandName:
        connection.businessBrand.name,
      brandStatus:
        connection.businessBrand.status,
      hasCredential:
        connection.credential !== null,
      accountCount:
        connection.socialAccounts.length,

      accounts: [...connection.socialAccounts]
        .sort((a, b) => {
          // Persisted selected/connected Page first — never alphabetical
          // discovery order for identity surfaces.
          const score = (row: {
            status: string;
            accessStatus: string;
          }) => {
            let value = 0;
            if (row.status === "connected") value += 100;
            if (row.accessStatus === "selected") value += 50;
            return value;
          };
          const delta = score(b) - score(a);
          if (delta !== 0) return delta;
          return (a.displayName ?? "").localeCompare(
            b.displayName ?? "",
          );
        })
        .map((account) => ({
          id: account.id,
          platform: account.platform,
          externalAccountId: account.externalAccountId,
          handle: account.handle,
          displayName: account.displayName,
          status: account.status,
          accessStatus: account.accessStatus,
          profileImageUrl: account.profileImageUrl,
        })),

      connectedAt:
        connection.connectedAt?.toISOString() ??
        null,

      disconnectedAt:
        connection.disconnectedAt?.toISOString() ??
        null,

      lastValidatedAt:
        connection.lastValidatedAt?.toISOString() ??
        null,

      lastSyncAt:
        connection.lastSyncAt?.toISOString() ??
        null,

      accessTokenExpiresAt:
        connection.accessTokenExpiresAt?.toISOString() ??
        null,

      refreshTokenExpiresAt:
        connection.refreshTokenExpiresAt?.toISOString() ??
        null,

      lastErrorCode:
        connection.lastErrorCode,

      lastErrorMessage:
        connection.lastErrorMessage,

      createdAt:
        connection.createdAt.toISOString(),

      updatedAt:
        connection.updatedAt.toISOString(),
    }),
  );
}
