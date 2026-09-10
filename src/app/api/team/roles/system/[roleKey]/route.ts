import { NextRequest, NextResponse } from "next/server";
import { assertClientCanManageCustomRoles } from "@/lib/billing/social/entitlement-gates";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { parsePermissionArray } from "@/lib/security/role-permissions";
import {
  isRoleKey,
  ROLE_PERMISSIONS,
  type RoleKey,
} from "@/lib/security/roles";
import { isServiceError } from "@/lib/services/service-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function samePermissions(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ roleKey: string }> },
): Promise<NextResponse> {
  const { roleKey } = await context.params;
  const { access } = await getServerAccessContext();

  if (access.mode === "denied" && access.reason === "not_authenticated") {
    return jsonResponse(
      { ok: false, message: "Authentication is required." },
      401,
    );
  }

  if (access.mode !== "client_scoped") {
    return jsonResponse(
      { ok: false, message: "Select a workspace first." },
      403,
    );
  }

  if (!hasEffectivePermission(access, "manage_permissions")) {
    return jsonResponse(
      {
        ok: false,
        message: "You do not have permission to manage permissions.",
      },
      403,
    );
  }

  try {
    await assertClientCanManageCustomRoles(access.activeClientId);
  } catch (error) {
    if (isServiceError(error)) {
      return jsonResponse({ ok: false, message: error.message }, error.status);
    }
    throw error;
  }

  if (!isRoleKey(roleKey)) {
    return jsonResponse(
      { ok: false, message: "Select a valid system role." },
      400,
    );
  }

  const systemRole = roleKey as RoleKey;

  if (systemRole === "owner") {
    return jsonResponse(
      { ok: false, message: "Owner permissions are fixed." },
      409,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, message: "The permission request is invalid." },
      400,
    );
  }

  if (typeof body !== "object" || body === null) {
    return jsonResponse(
      { ok: false, message: "The permission request is invalid." },
      400,
    );
  }

  const permissions = parsePermissionArray(
    (body as { permissions?: unknown }).permissions,
  );

  if (!permissions) {
    return jsonResponse(
      { ok: false, message: "One or more selected permissions are invalid." },
      400,
    );
  }

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse(
      { ok: false, message: "The database is unavailable." },
      503,
    );
  }

  try {
    const defaults = ROLE_PERMISSIONS[systemRole];

    await prisma.$transaction(async (transaction) => {
      if (samePermissions(permissions, defaults)) {
        await transaction.workspaceRolePermissionOverride.deleteMany({
          where: {
            clientId: access.activeClientId,
            role: systemRole,
          },
        });
      } else {
        await transaction.workspaceRolePermissionOverride.upsert({
          where: {
            clientId_role: {
              clientId: access.activeClientId,
              role: systemRole,
            },
          },
          create: {
            clientId: access.activeClientId,
            role: systemRole,
            permissions,
          },
          update: {
            permissions,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId: access.activeClientId,
          action: "workspace_system_role_permissions_updated",
          entityType: "WorkspaceRolePermissionOverride",
          entityId: systemRole,
          metadata: {
            note: `Updated ${systemRole} role permissions.`,
            permissions,
          },
        },
      });
    });

    return jsonResponse(
      { ok: true, message: "The role permissions were updated." },
      200,
    );
  } catch (error) {
    console.error(
      "[team-roles] System role update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { ok: false, message: "The role permissions could not be updated." },
      500,
    );
  }
}
