import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { assertProfileCanManageSocialAccounts } from "@/lib/social/connections/social-connection-auth";

export type AssignedBrandSocialAccount = {
  assignmentId: string;
  businessBrandId: string;
  socialAccountId: string;
  connectionId: string;
  status: "active";
  connectionStatus: "connected";
  assignedAt: string;
};

type DbClient =
  | Prisma.TransactionClient
  | NonNullable<ReturnType<typeof getPrisma>>;

/**
 * Assign a discovered Facebook Page (SocialAccount) to a Brand.
 *
 * Lifecycle rule: provider connection becomes `connected` only after
 * a successful active assignment inside the same transaction.
 *
 * MVP policies:
 * - Brand and Page must share the same Client
 * - Page must belong to the provider connection / Client
 * - Page accessStatus must be available or selected
 * - One active assignment per Brand+Page pair
 * - One Page may not be actively shared across Brands
 */
export async function assignSocialAccountToBrand(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  socialAccountId: string;
  connectionId: string;
}): Promise<AssignedBrandSocialAccount> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  return prisma.$transaction(async (transaction) => {
    await assertProfileCanManageSocialAccounts(transaction, {
      clientId: options.clientId,
      profileId: options.profileId,
    });

    const brand = await transaction.businessBrand.findFirst({
      where: {
        id: options.businessBrandId,
        clientId: options.clientId,
        status: { notIn: ["archived", "frozen"] },
      },
      select: { id: true },
    });

    if (!brand) {
      throw new ServiceError(
        "not_found",
        "The selected brand could not be found in this workspace.",
      );
    }

    const connection =
      await transaction.socialProviderConnection.findFirst({
        where: {
          id: options.connectionId,
          clientId: options.clientId,
          businessBrandId: brand.id,
        },
        select: {
          id: true,
          status: true,
          scopes: true,
        },
      });

    if (!connection) {
      throw new ServiceError(
        "not_found",
        "The social provider connection could not be found for this brand.",
      );
    }

    if (
      connection.status !== "authorized" &&
      connection.status !== "connected"
    ) {
      throw new ServiceError(
        "conflict",
        "The provider connection must be authorized before a Page can be assigned.",
      );
    }

    const account = await transaction.socialAccount.findFirst({
      where: {
        id: options.socialAccountId,
        clientId: options.clientId,
        providerConnectionId: connection.id,
      },
      select: {
        id: true,
        platform: true,
        accountType: true,
        accessStatus: true,
        isAvailableThroughAuth: true,
        externalAccountId: true,
      },
    });

    if (!account) {
      throw new ServiceError(
        "not_found",
        "The selected social account does not belong to this connection.",
      );
    }

    if (
      account.platform !== "facebook" ||
      account.accountType !== "facebook_page"
    ) {
      throw new ServiceError(
        "invalid_input",
        "Only Facebook Page accounts can be assigned in this flow.",
      );
    }

    if (
      !account.isAvailableThroughAuth ||
      (account.accessStatus !== "available" &&
        account.accessStatus !== "selected")
    ) {
      throw new ServiceError(
        "conflict",
        "The Facebook Page is not currently available for assignment.",
      );
    }

    if (!account.externalAccountId) {
      throw new ServiceError(
        "conflict",
        "The Facebook Page is missing its external account identifier.",
      );
    }

    const activeElsewhere =
      await transaction.socialBrandAccountAssignment.findFirst({
        where: {
          socialAccountId: account.id,
          status: "active",
          NOT: {
            businessBrandId: brand.id,
          },
        },
        select: { id: true },
      });

    if (activeElsewhere) {
      throw new ServiceError(
        "conflict",
        "This Facebook Page is already assigned to another brand.",
      );
    }

    // Workspace scope: the same Meta Page must not be connected twice
    // under any SocialAccount row in this Client.
    const connectedSamePage =
      await transaction.socialAccount.findFirst({
        where: {
          clientId: options.clientId,
          platform: "facebook",
          externalAccountId: account.externalAccountId,
          status: "connected",
          NOT: { id: account.id },
        },
        select: { id: true },
      });

    if (connectedSamePage) {
      throw new ServiceError(
        "conflict",
        "This Facebook Page is already connected in this workspace.",
      );
    }

    const now = new Date();

    const assignment =
      await transaction.socialBrandAccountAssignment.upsert({
        where: {
          businessBrandId_socialAccountId: {
            businessBrandId: brand.id,
            socialAccountId: account.id,
          },
        },
        update: {
          status: "active",
          assignedAt: now,
          assignedByProfileId: options.profileId,
          unassignedAt: null,
        },
        create: {
          clientId: options.clientId,
          businessBrandId: brand.id,
          socialAccountId: account.id,
          status: "active",
          assignedAt: now,
          assignedByProfileId: options.profileId,
        },
        select: {
          id: true,
          businessBrandId: true,
          socialAccountId: true,
          assignedAt: true,
        },
      });

    await transaction.socialAccount.update({
      where: { id: account.id },
      data: {
        accessStatus: "selected",
        status: "connected",
        businessBrandId: brand.id,
        isAvailableThroughAuth: true,
      },
    });

    await transaction.socialProviderConnection.update({
      where: { id: connection.id },
      data: {
        status: "connected",
        connectedAt: now,
        disconnectedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });

    return {
      assignmentId: assignment.id,
      businessBrandId: assignment.businessBrandId,
      socialAccountId: assignment.socialAccountId,
      connectionId: connection.id,
      status: "active",
      connectionStatus: "connected",
      assignedAt: assignment.assignedAt.toISOString(),
    };
  });
}

/**
 * Soft-unassign a Page from a Brand. Preserves history.
 * Connection returns to authorized when no active assignments remain.
 */
export async function unassignSocialAccountFromBrand(options: {
  clientId: string;
  profileId: string;
  businessBrandId: string;
  socialAccountId: string;
}): Promise<void> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
    );
  }

  await prisma.$transaction(async (transaction) => {
    await assertProfileCanManageSocialAccounts(transaction, {
      clientId: options.clientId,
      profileId: options.profileId,
    });

    const assignment =
      await transaction.socialBrandAccountAssignment.findFirst({
        where: {
          clientId: options.clientId,
          businessBrandId: options.businessBrandId,
          socialAccountId: options.socialAccountId,
          status: "active",
        },
        select: {
          id: true,
          socialAccount: {
            select: {
              id: true,
              providerConnectionId: true,
            },
          },
        },
      });

    if (!assignment) {
      throw new ServiceError(
        "not_found",
        "No active brand assignment was found for this Page.",
      );
    }

    const now = new Date();

    await transaction.socialBrandAccountAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "inactive",
        unassignedAt: now,
      },
    });

    await transaction.socialAccount.update({
      where: { id: assignment.socialAccount.id },
      data: {
        accessStatus: "available",
        status: "not_connected",
        businessBrandId: null,
      },
    });

    const connectionId =
      assignment.socialAccount.providerConnectionId;

    if (connectionId) {
      await refreshConnectionStatusAfterAssignmentChange(
        transaction,
        {
          clientId: options.clientId,
          connectionId,
        },
      );
    }
  });
}

export async function deactivateAssignmentsForConnection(
  db: DbClient,
  options: {
    clientId: string;
    connectionId: string;
    at?: Date;
  },
): Promise<void> {
  const at = options.at ?? new Date();

  const accounts = await db.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
    },
    select: { id: true },
  });

  const accountIds = accounts.map((account) => account.id);

  if (accountIds.length === 0) {
    return;
  }

  await db.socialBrandAccountAssignment.updateMany({
    where: {
      clientId: options.clientId,
      socialAccountId: { in: accountIds },
      status: "active",
    },
    data: {
      status: "inactive",
      unassignedAt: at,
    },
  });

  await db.socialAccount.updateMany({
    where: {
      clientId: options.clientId,
      id: { in: accountIds },
    },
    data: {
      accessStatus: "removed",
      isAvailableThroughAuth: false,
      status: "not_connected",
      businessBrandId: null,
    },
  });
}

async function refreshConnectionStatusAfterAssignmentChange(
  db: DbClient,
  options: {
    clientId: string;
    connectionId: string;
  },
): Promise<void> {
  const accounts = await db.socialAccount.findMany({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
    },
    select: { id: true },
  });

  const activeCount =
    await db.socialBrandAccountAssignment.count({
      where: {
        clientId: options.clientId,
        socialAccountId: {
          in: accounts.map((account) => account.id),
        },
        status: "active",
      },
    });

  if (activeCount === 0) {
    await db.socialProviderConnection.updateMany({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        status: "connected",
      },
      data: {
        status: "authorized",
        connectedAt: null,
      },
    });
  }
}
