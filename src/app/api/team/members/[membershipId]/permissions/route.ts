import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import {
  ALL_PERMISSIONS,
  type Permission,
  type RoleKey,
} from "@/lib/security/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_LEVELS: Record<RoleKey, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  editor: 3,
  staff: 2,
  viewer: 1,
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  const response = NextResponse.json(body, {
    status,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}

function parsePermissionArray(
  value: unknown,
): Permission[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const permissions = new Set<Permission>();

  for (const item of value) {
    if (
      typeof item !== "string" ||
      !ALL_PERMISSIONS.includes(item as Permission)
    ) {
      return null;
    }

    permissions.add(item as Permission);
  }

  return Array.from(permissions);
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      membershipId: string;
    }>;
  },
): Promise<NextResponse> {
  const { membershipId } = await context.params;
  const { access } = await getServerAccessContext();

  if (
    access.mode === "denied" &&
    access.reason === "not_authenticated"
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Authentication is required.",
      },
      401,
    );
  }

  if (access.mode !== "client_scoped") {
    return jsonResponse(
      {
        ok: false,
        message: "Select a workspace first.",
      },
      403,
    );
  }

  if (
    !hasEffectivePermission(
      access,
      "manage_permissions",
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to manage custom permissions.",
      },
      403,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "The permission request is invalid.",
      },
      400,
    );
  }

  if (
    typeof body !== "object" ||
    body === null
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "The permission request is invalid.",
      },
      400,
    );
  }

  const input = body as {
    customPermissions?: unknown;
    deniedPermissions?: unknown;
  };

  const customPermissions = parsePermissionArray(
    input.customPermissions,
  );

  const deniedPermissions = parsePermissionArray(
    input.deniedPermissions,
  );

  if (!customPermissions || !deniedPermissions) {
    return jsonResponse(
      {
        ok: false,
        message:
          "One or more selected permissions are invalid.",
      },
      400,
    );
  }

  const overlappingPermission =
    customPermissions.find((permission) =>
      deniedPermissions.includes(permission),
    );

  if (overlappingPermission) {
    return jsonResponse(
      {
        ok: false,
        message:
          "A permission cannot be both granted and denied.",
      },
      400,
    );
  }

  const unauthorizedGrant =
    customPermissions.find(
      (permission) =>
        !hasEffectivePermission(access, permission),
    );

  if (unauthorizedGrant) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You cannot grant a permission that you do not have.",
      },
      403,
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return jsonResponse(
      {
        ok: false,
        message: "The database is unavailable.",
      },
      503,
    );
  }

  try {
    const targetMembership =
      await prisma.clientMembership.findFirst({
        where: {
          id: membershipId,
          clientId: access.activeClientId,
        },
        select: {
          id: true,
          profileId: true,
          role: true,
          customPermissions: true,
          deniedPermissions: true,
          profile: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      });

    if (!targetMembership) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The workspace member could not be found.",
        },
        404,
      );
    }

    if (
      targetMembership.profileId === access.profileId
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot change your own custom permissions.",
        },
        409,
      );
    }

    if (targetMembership.role === "owner") {
      return jsonResponse(
        {
          ok: false,
          message:
            "Owner permissions cannot be customized.",
        },
        409,
      );
    }

    if (
      ROLE_LEVELS[targetMembership.role] >
      ROLE_LEVELS[access.role]
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot modify a member with a higher role.",
        },
        403,
      );
    }

    const updatedMembership =
      await prisma.$transaction(
        async (transaction) => {
          const membership =
            await transaction.clientMembership.update({
              where: {
                id: targetMembership.id,
              },
              data: {
                customPermissions,
                deniedPermissions,
              },
              select: {
                id: true,
                customPermissions: true,
                deniedPermissions: true,
              },
            });

          await transaction.auditLog.create({
            data: {
              profileId: access.profileId,
              clientId: access.activeClientId,
              action:
                "workspace_member_permissions_changed",
              entityType: "ClientMembership",
              entityId: targetMembership.id,
              metadata: {
                note: `Custom permissions were updated for ${
                  targetMembership.profile.displayName ??
                  targetMembership.profile.email ??
                  "a workspace member"
                }.`,
                previousCustomPermissions:
                  targetMembership.customPermissions,
                previousDeniedPermissions:
                  targetMembership.deniedPermissions,
                customPermissions,
                deniedPermissions,
              },
            },
          });

          return membership;
        },
      );

    return jsonResponse(
      {
        ok: true,
        message:
          "The member permissions were updated successfully.",
        membership: updatedMembership,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[team-permissions] Permission update failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "The member permissions could not be updated.",
      },
      500,
    );
  }
}