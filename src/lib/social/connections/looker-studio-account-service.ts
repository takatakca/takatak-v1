import "server-only";

import { Prisma } from "@prisma/client";

import { assertClientCanConnectSocial } from "@/lib/billing/client-subscription-access";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";
import { runSocialDbTransaction } from "@/lib/social/connections/social-db-transaction";
import type { LookerStudioReportRecord } from "@/lib/social/providers/looker-studio-accounts";
import { lookerStudioReportUrl } from "@/lib/social/providers/looker-studio-accounts";

const ALREADY_CONNECTED =
  "This Looker Studio report is already connected in this workspace.";

function metadataFor(report: LookerStudioReportRecord): Prisma.InputJsonValue {
  return {
    source: "looker_studio",
    owner: report.owner,
    reportUrl: report.reportUrl,
  };
}

async function assertReportIsFree(
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
      platform: "looker_studio",
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

async function selectStoredReport(
  transaction: Prisma.TransactionClient,
  options: {
    clientId: string;
    connectionId: string;
    businessBrandId: string;
    socialAccountId: string;
    displayName: string;
  },
): Promise<void> {
  const now = new Date();

  await transaction.socialAccount.updateMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "looker_studio",
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

export async function syncDiscoveredLookerStudioReports(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  reports: LookerStudioReportRecord[];
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
      "looker-studio-report-discover",
      async (transaction) => {
        await assertProfileCanManageSocialAccounts(transaction, {
          clientId: options.clientId,
          profileId: options.profileId,
        });

        const connection = await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
            provider: "looker_studio",
          },
          select: { id: true, businessBrandId: true },
        });

        if (!connection) {
          throw new ServiceError(
            "not_found",
            "The Looker Studio connection could not be found.",
          );
        }

        await assertClientCanConnectSocial(transaction, options.clientId, {
          provider: "looker_studio",
          reconnect: true,
        });

        const previouslySelected = await transaction.socialAccount.findFirst({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "looker_studio",
            status: "connected",
            accessStatus: "selected",
          },
          select: { externalAccountId: true },
        });

        const now = new Date();
        const discoveredIds = options.reports.map(
          (report) => report.externalAccountId,
        );

        for (const report of options.reports) {
          await transaction.socialAccount.upsert({
            where: {
              providerConnectionId_platform_externalAccountId: {
                providerConnectionId: connection.id,
                platform: "looker_studio",
                externalAccountId: report.externalAccountId,
              },
            },
            update: {
              businessBrandId: connection.businessBrandId,
              displayName: report.displayName,
              handle: null,
              accountType: "looker_studio_report",
              status: "pending_connection",
              accessStatus: "available",
              isAvailableThroughAuth: true,
              lastDiscoveredAt: now,
              metadata: metadataFor(report),
            },
            create: {
              clientId: options.clientId,
              businessBrandId: connection.businessBrandId,
              providerConnectionId: connection.id,
              platform: "looker_studio",
              accountType: "looker_studio_report",
              externalAccountId: report.externalAccountId,
              displayName: report.displayName,
              status: "pending_connection",
              accessStatus: "available",
              isAvailableThroughAuth: true,
              firstDiscoveredAt: now,
              lastDiscoveredAt: now,
              metadata: metadataFor(report),
            },
          });
        }

        await transaction.socialAccount.updateMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "looker_studio",
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
          return { selected: false };
        }

        const stored = await transaction.socialAccount.findMany({
          where: {
            clientId: options.clientId,
            providerConnectionId: connection.id,
            platform: "looker_studio",
            isAvailableThroughAuth: true,
            externalAccountId: { in: discoveredIds },
          },
          select: {
            id: true,
            externalAccountId: true,
            displayName: true,
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

        const match = options.reports.find(
          (report) => report.externalAccountId === chosen.externalAccountId,
        );
        if (!match) {
          return { selected: false };
        }

        await assertReportIsFree(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          externalAccountId: chosen.externalAccountId,
        });

        await selectStoredReport(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          businessBrandId: connection.businessBrandId,
          socialAccountId: chosen.id,
          displayName: match.displayName,
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

export async function selectLookerStudioReport(options: {
  clientId: string;
  profileId: string;
  connectionId: string;
  socialAccountId: string;
}): Promise<{ displayName: string; reportUrl: string | null }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  try {
    return await runSocialDbTransaction(
      "looker-studio-report-select",
      async (transaction) => {
        await assertProfileCanManageSocialAccounts(transaction, {
          clientId: options.clientId,
          profileId: options.profileId,
        });

        const connection = await transaction.socialProviderConnection.findFirst({
          where: {
            id: options.connectionId,
            clientId: options.clientId,
            provider: "looker_studio",
            status: { in: ["authorized", "connected"] },
          },
          select: { id: true, businessBrandId: true },
        });

        if (!connection) {
          throw new ServiceError(
            "not_found",
            "The Looker Studio connection could not be found.",
          );
        }

        const account = await transaction.socialAccount.findFirst({
          where: {
            id: options.socialAccountId,
            clientId: options.clientId,
            providerConnectionId: connection.id,
            businessBrandId: connection.businessBrandId,
            platform: "looker_studio",
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
            "Choose a Looker Studio report from this connection.",
          );
        }

        const reportUrl = lookerStudioReportUrl(account.externalAccountId);
        if (!reportUrl) {
          throw new ServiceError(
            "not_found",
            "Choose a Looker Studio report from this connection.",
          );
        }

        await assertClientCanConnectSocial(transaction, options.clientId, {
          provider: "looker_studio",
          reconnect: account.status === "connected",
        });

        await assertReportIsFree(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          externalAccountId: account.externalAccountId,
        });

        const displayName =
          account.displayName?.trim() || "Looker Studio report";

        await selectStoredReport(transaction, {
          clientId: options.clientId,
          connectionId: connection.id,
          businessBrandId: connection.businessBrandId,
          socialAccountId: account.id,
          displayName,
        });

        return {
          displayName,
          reportUrl,
        };
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
