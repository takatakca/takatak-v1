import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { deactivateAssignmentsForConnection } from "@/lib/social/connections/social-brand-assignment";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";

export type DisconnectedSocialConnection = {
  id: string;
  provider: string;
  status: string;
  businessBrandId: string;
  disconnectedAt: string;
};

// export async function disconnectSocialConnection(
//   options: {
//     clientId: string;
//     profileId: string;
//     connectionId: string;
//   },
// ): Promise<DisconnectedSocialConnection> {
//   const prisma = getPrisma();

//   if (!prisma) {
//     throw new ServiceError(
//       "unavailable",
//       "The social connection database is unavailable.",
//     );
//   }

//   return prisma.$transaction(
//     async (transaction) => {
//       await assertProfileCanManageSocialAccounts(
//         transaction,
//         {
//           clientId: options.clientId,
//           profileId: options.profileId,
//         },
//       );

//       const connection =
//         await transaction.socialProviderConnection.findFirst({
//           where: {
//             id: options.connectionId,
//             clientId:
//               options.clientId,
//           },

//           select: {
//             id: true,
//             provider: true,
//             status: true,
//             businessBrandId: true,
//           },
//         });

//       if (!connection) {
//         throw new ServiceError(
//           "not_found",
//           "The selected social connection could not be found in this workspace.",
//         );
//       }

//       const disconnectedAt =
//         new Date();

//       /*
//        * Soft-disable Brand↔Page assignments while Pages still
//        * reference this connection, then detach Pages without
//        * deleting non-secret history.
//        */
//       await deactivateAssignmentsForConnection(
//         transaction,
//         {
//           clientId: options.clientId,
//           connectionId: connection.id,
//           at: disconnectedAt,
//         },
//       );

//       await transaction.socialAccount.updateMany({
//         where: {
//           clientId:
//             options.clientId,

//           providerConnectionId:
//             connection.id,
//         },

//         data: {
//           providerConnectionId:
//             null,

//           status:
//             "not_connected",

//           lastSyncAt: null,
//         },
//       });

//       /*
//        * Mark credential revoked, then delete encrypted material.
//        * Policy: disconnect must not leave usable tokens stored.
//        */
//       await transaction.socialCredential.updateMany({
//         where: {
//           clientId:
//             options.clientId,

//           connectionId:
//             connection.id,
//         },

//         data: {
//           status: "revoked",
//           statusChangedAt:
//             disconnectedAt,
//         },
//       });

//       await transaction.socialCredential.deleteMany({
//         where: {
//           clientId:
//             options.clientId,

//           connectionId:
//             connection.id,
//         },
//       });

//       /*
//        * Cancel any unfinished OAuth attempts attached to this
//        * connection so their states cannot later be completed.
//        */
//       await transaction.socialOAuthState.updateMany({
//         where: {
//           clientId:
//             options.clientId,

//           connectionId:
//             connection.id,

//           status: "pending",
//         },

//         data: {
//           status: "cancelled",

//           consumedAt:
//             disconnectedAt,

//           errorMessage:
//             "The connection was disconnected before authorization completed.",
//         },
//       });

//       const updated =
//         await transaction.socialProviderConnection.update({
//           where: {
//             id: connection.id,
//           },

//           data: {
//             status: "disconnected",

//             accessTokenExpiresAt:
//               null,

//             refreshTokenExpiresAt:
//               null,

//             lastValidatedAt: null,
//             lastSyncAt: null,
//             lastErrorCode: null,
//             lastErrorMessage: null,

//             disconnectedAt,
//           },

//           select: {
//             id: true,
//             provider: true,
//             status: true,
//             businessBrandId: true,
//             disconnectedAt: true,
//           },
//         });

//       await transaction.auditLog.create({
//         data: {
//           profileId:
//             options.profileId,

//           clientId:
//             options.clientId,

//           action:
//             "social.connection.disconnected",

//           entityType:
//             "social_provider_connection",

//           entityId:
//             connection.id,

//           metadata: {
//             provider:
//               connection.provider,

//             businessBrandId:
//               connection.businessBrandId,

//             previousStatus:
//               connection.status,

//             note:
//               "Encrypted credentials removed, pending OAuth states cancelled, and imported accounts retained as not connected.",
//           },
//         },
//       });

//       return {
//         id: updated.id,
//         provider:
//           updated.provider,
//         status: updated.status,
//         businessBrandId:
//           updated.businessBrandId,

//         disconnectedAt:
//           (
//             updated.disconnectedAt ??
//             disconnectedAt
//           ).toISOString(),
//       };
//     },
//   );
// }

export async function disconnectSocialConnection(
  options: {
    clientId: string;
    profileId: string;
    connectionId: string;
  },
): Promise<DisconnectedSocialConnection> {
  return runSocialDbTransaction(
    "social-connection-disconnect",
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

      const disconnectedAt = new Date();

      /*
       * Soft-disable Brand↔Page assignments while Pages still
       * reference this connection, then detach Pages without
       * deleting non-secret history.
       */
      await deactivateAssignmentsForConnection(
        transaction,
        {
          clientId: options.clientId,
          connectionId: connection.id,
          at: disconnectedAt,
        },
      );

      await transaction.socialAccount.updateMany({
        where: {
          clientId: options.clientId,
          providerConnectionId: connection.id,
        },
        data: {
          providerConnectionId: null,
          status: "not_connected",
          lastSyncAt: null,
        },
      });

      /*
       * Mark credential revoked, then delete encrypted material.
       * Policy: disconnect must not leave usable tokens stored.
       */
      await transaction.socialCredential.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: connection.id,
        },
        data: {
          status: "revoked",
          statusChangedAt: disconnectedAt,
        },
      });

      await transaction.socialCredential.deleteMany({
        where: {
          clientId: options.clientId,
          connectionId: connection.id,
        },
      });

      /*
       * Cancel any unfinished OAuth attempts attached to this
       * connection so their states cannot later be completed.
       */
      await transaction.socialOAuthState.updateMany({
        where: {
          clientId: options.clientId,
          connectionId: connection.id,
          status: "pending",
        },
        data: {
          status: "cancelled",
          consumedAt: disconnectedAt,
          errorMessage:
            "The connection was disconnected before authorization completed.",
        },
      });

      const updated =
        await transaction.socialProviderConnection.update({
          where: {
            id: connection.id,
          },
          data: {
            status: "disconnected",
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
            lastValidatedAt: null,
            lastSyncAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            disconnectedAt,
          },
          select: {
            id: true,
            provider: true,
            status: true,
            businessBrandId: true,
            disconnectedAt: true,
          },
        });

      await transaction.auditLog.create({
        data: {
          profileId: options.profileId,
          clientId: options.clientId,
          action: "social.connection.disconnected",
          entityType: "social_provider_connection",
          entityId: connection.id,
          metadata: {
            provider: connection.provider,
            businessBrandId: connection.businessBrandId,
            previousStatus: connection.status,
            note:
              "Encrypted credentials removed, pending OAuth states cancelled, and imported accounts retained as not connected.",
          },
        },
      });

      return {
        id: updated.id,
        provider: updated.provider,
        status: updated.status,
        businessBrandId: updated.businessBrandId,
        disconnectedAt: (
          updated.disconnectedAt ?? disconnectedAt
        ).toISOString(),
      };
    },
    {
      maxWaitMs: 15_000,
      timeoutMs: 15_000,
    },
  );
}
