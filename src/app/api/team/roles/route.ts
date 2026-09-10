import { NextRequest, NextResponse } from "next/server";
import { assertClientCanManageCustomRoles } from "@/lib/billing/social/entitlement-gates";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import {
  isReservedRoleName,
  normalizeRoleName,
  parsePermissionArray,
} from "@/lib/security/role-permissions";
import { ROLE_PERMISSIONS } from "@/lib/security/roles";
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

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  if (!hasEffectivePermission(access, "manage_roles")) {
    return jsonResponse(
      { ok: false, message: "You do not have permission to manage roles." },
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, message: "The role request is invalid." },
      400,
    );
  }

  if (typeof body !== "object" || body === null) {
    return jsonResponse(
      { ok: false, message: "The role request is invalid." },
      400,
    );
  }

  const input = body as { name?: unknown; permissions?: unknown };
  const name = normalizeRoleName(input.name);

  if (!name) {
    return jsonResponse(
      {
        ok: false,
        message: "Enter a role name between 2 and 60 characters.",
      },
      400,
    );
  }

  if (isReservedRoleName(name)) {
    return jsonResponse(
      {
        ok: false,
        message: "That name is reserved for a system role.",
      },
      409,
    );
  }

  const permissions = input.permissions
    ? parsePermissionArray(input.permissions)
    : [...ROLE_PERMISSIONS.viewer];

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
    const duplicate = await prisma.workspaceCustomRole.findFirst({
      where: {
        clientId: access.activeClientId,
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicate) {
      return jsonResponse(
        { ok: false, message: "A role with that name already exists." },
        409,
      );
    }

    const role = await prisma.$transaction(async (transaction) => {
      const created = await transaction.workspaceCustomRole.create({
        data: {
          clientId: access.activeClientId,
          name,
          permissions,
        },
        select: {
          id: true,
          name: true,
          permissions: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId: access.activeClientId,
          action: "workspace_custom_role_created",
          entityType: "WorkspaceCustomRole",
          entityId: created.id,
          metadata: {
            note: `Created custom role ${created.name}.`,
            permissions,
          },
        },
      });

      return created;
    });

    return jsonResponse(
      {
        ok: true,
        message: "The role was created.",
        role,
      },
      201,
    );
  } catch (error) {
    console.error(
      "[team-roles] Create failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { ok: false, message: "The role could not be created." },
      500,
    );
  }
}
