import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import type { GoogleBusinessLocationRecord } from "@/lib/social/providers/google-business-profile";

export async function persistGoogleBusinessLocations(
  options: {
    clientId: string;
    profileId: string;
    connectionId: string;
    locations: GoogleBusinessLocationRecord[];
  },
): Promise<{ storedCount: number }> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  await runSocialDbTransaction(
    "google-business-location-discover",
    async (transaction) => {
      await assertProfileCanManageSocialAccounts(
        transaction,
        {
          clientId: options.clientId,
          profileId: options.profileId,
        },
      );

      const connection =
        await transaction.socialProviderConnection.findFirst(
          {
            where: {
              id: options.connectionId,
              clientId: options.clientId,
              provider: "google_business",
            },
            select: {
              id: true,
              businessBrandId: true,
            },
          },
        );

      if (!connection) {
        throw new ServiceError(
          "not_found",
          "The Google connection could not be found.",
        );
      }

      const now = new Date();

      const seenIds = new Set<string>();

      for (const location of options.locations) {
        seenIds.add(
          location.externalAccountId,
        );

        await transaction.socialAccount.upsert({
          where: {
            providerConnectionId_platform_externalAccountId:
              {
                providerConnectionId:
                  connection.id,
                platform:
                  "google_business",
                externalAccountId:
                  location.externalAccountId,
              },
          },
          update: {
            businessBrandId:
              connection.businessBrandId,
            displayName:
              location.displayName,
            handle: location.handle,
            category: location.category,
            profileUrl:
              location.profileUrl,
            accountType:
              "google_business_location",
            status: "connected",
            accessStatus: "selected",
            isAvailableThroughAuth: true,
            lastDiscoveredAt: now,
            metadata: location.metadata,
          },
          create: {
            clientId: options.clientId,
            businessBrandId:
              connection.businessBrandId,
            providerConnectionId:
              connection.id,
            externalAccountId:
              location.externalAccountId,
            platform: "google_business",
            displayName:
              location.displayName,
            handle: location.handle,
            category: location.category,
            profileUrl:
              location.profileUrl,
            accountType:
              "google_business_location",
            status: "connected",
            accessStatus: "selected",
            isAvailableThroughAuth: true,
            firstDiscoveredAt: now,
            lastDiscoveredAt: now,
            metadata: location.metadata,
          },
        });
      }

      await transaction.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId:
            connection.id,
          platform: "google_business",
          ...(seenIds.size > 0
            ? {
                NOT: {
                  externalAccountId: {
                    in: [...seenIds],
                  },
                },
              }
            : {}),
        },
        data: {
          status: "not_connected",
          accessStatus: "removed",
          isAvailableThroughAuth: false,
          businessBrandId: null,
        },
      });

      if (options.locations.length > 0) {
        await transaction.socialProviderConnection.update(
          {
            where: {
              id: connection.id,
            },
            data: {
              status: "connected",
              connectedAt: now,
              displayName:
                options.locations.length ===
                1
                  ? options.locations[0]
                      .displayName
                  : `${options.locations.length} Google Business locations`,
              lastValidatedAt: now,
              lastErrorCode: null,
              lastErrorMessage: null,
              lastErrorAt: null,
            },
          },
        );
      }
    },
  );

  logSocialOAuthEvent(
    "google-business-location-selection",
    {
      stage: "discover",
      outcome:
        options.locations.length > 0
          ? "selected"
          : "empty",
      provider: "google_business",
      rawCount: options.locations.length,
    },
  );

  return {
    storedCount: options.locations.length,
  };
}
