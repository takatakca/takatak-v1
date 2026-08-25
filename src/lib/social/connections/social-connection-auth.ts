import "server-only";

import type { Prisma } from "@prisma/client";

import { ServiceError } from "@/lib/services/service-error";
import {
  isRoleKey,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/security/roles";

type DbClient =
  | Prisma.TransactionClient
  | {
      clientMembership: Prisma.TransactionClient["clientMembership"];
    };

/**
 * Defense-in-depth authorization for social OAuth attempts.
 * Route gates are not enough — the service must re-check
 * active ClientMembership + manage_social_accounts from the DB.
 */
export async function assertProfileCanManageSocialAccounts(
  db: DbClient,
  options: {
    clientId: string;
    profileId: string;
  },
): Promise<void> {
  const membership =
    await db.clientMembership.findUnique({
      where: {
        profileId_clientId: {
          profileId: options.profileId,
          clientId: options.clientId,
        },
      },
      select: {
        status: true,
        role: true,
        customPermissions: true,
        deniedPermissions: true,
      },
    });

  if (
    !membership ||
    membership.status !== "active"
  ) {
    throw new ServiceError(
      "forbidden",
      "You do not have an active membership in this workspace.",
    );
  }

  if (!isRoleKey(membership.role)) {
    throw new ServiceError(
      "forbidden",
      "You do not have permission to manage social connections.",
    );
  }

  if (membership.role === "owner") {
    return;
  }

  const permissions = new Set<Permission>([
    ...ROLE_PERMISSIONS[membership.role],
    ...(membership.customPermissions as Permission[]),
  ]);

  for (const deniedPermission of membership.deniedPermissions) {
    permissions.delete(
      deniedPermission as Permission,
    );
  }

  if (
    !permissions.has(
      "manage_social_accounts",
    )
  ) {
    throw new ServiceError(
      "forbidden",
      "You do not have permission to manage social connections.",
    );
  }
}
