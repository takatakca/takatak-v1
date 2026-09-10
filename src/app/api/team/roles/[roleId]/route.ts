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

type RoleAccessResult =
  | {
      ok: true;
      access: Extract<
        Awaited<ReturnType<typeof getServerAccessContext>>["access"],
        { mode: "client_scoped" }
      >;
    }
  | { ok: false; response: NextResponse };

async function requireCustomRoleAccess(): Promise<RoleAccessResult> {
  const { access } = await getServerAccessContext();

  if (access.mode === "denied" && access.reason === "not_authenticated") {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, message: "Authentication is required." },
        401,
      ),
    };
  }

  if (access.mode !== "client_scoped") {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, message: "Select a workspace first." },
        403,
      ),
    };
  }

  if (!hasEffectivePermission(access, "manage_roles")) {
    return {
      ok: false,
      response: jsonResponse(
        { ok: false, message: "You do not have permission to manage roles." },
        403,
      ),
    };
  }

  try {
    await assertClientCanManageCustomRoles(access.activeClientId);
  } catch (error) {
    if (isServiceError(error)) {
      return {
        ok: false,
        response: jsonResponse(
          { ok: false, message: error.message },
          error.status,
        ),
      };
    }
    throw error;
  }

  return { ok: true, access };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ roleId: string }> },
): Promise<NextResponse> {
  const { roleId } = await context.params;
  const gated = await requireCustomRoleAccess();
  if (!gated.ok) {
    return gated.response;
  }
  const { access } = gated;

  if (!hasEffectivePermission(access, "manage_permissions")) {
    return jsonResponse(
      {
        ok: false,
        message: "You do not have permission to manage permissions.",
      },
      403,
    );
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
  const name =
    input.name === undefined ? undefined : normalizeRoleName(input.name);
  const permissions =
    input.permissions === undefined
      ? undefined
      : parsePermissionArray(input.permissions);

  if (input.name !== undefined && !name) {
    return jsonResponse(
      {
        ok: false,
        message: "Enter a role name between 2 and 60 characters.",
      },
      400,
    );
  }

  if (name && isReservedRoleName(name)) {
    return jsonResponse(
      {
        ok: false,
        message: "That name is reserved for a system role.",
      },
      409,
    );
  }

  if (permissions === null) {
    return jsonResponse(
      { ok: false, message: "One or more selected permissions are invalid." },
      400,
    );
  }

  if (!name && permissions === undefined) {
    return jsonResponse(
      { ok: false, message: "Provide a name or permissions to update." },
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
    const existing = await prisma.workspaceCustomRole.findFirst({
      where: {
        id: roleId,
        clientId: access.activeClientId,
      },
      select: { id: true, name: true },
    });

    if (!existing) {
      return jsonResponse(
        { ok: false, message: "The role could not be found." },
        404,
      );
    }

    if (name && name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.workspaceCustomRole.findFirst({
        where: {
          clientId: access.activeClientId,
          id: { not: existing.id },
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
    }

    const role = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.workspaceCustomRole.update({
        where: { id: existing.id },
        data: {
          ...(name ? { name } : {}),
          ...(permissions !== undefined ? { permissions } : {}),
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
          action: "workspace_custom_role_updated",
          entityType: "WorkspaceCustomRole",
          entityId: updated.id,
          metadata: {
            note: `Updated custom role ${updated.name}.`,
            previousName: existing.name,
          },
        },
      });

      return updated;
    });

    return jsonResponse(
      { ok: true, message: "The role was updated.", role },
      200,
    );
  } catch (error) {
    console.error(
      "[team-roles] Update failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { ok: false, message: "The role could not be updated." },
      500,
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ roleId: string }> },
): Promise<NextResponse> {
  const { roleId } = await context.params;
  const gated = await requireCustomRoleAccess();
  if (!gated.ok) {
    return gated.response;
  }
  const { access } = gated;

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse(
      { ok: false, message: "The database is unavailable." },
      503,
    );
  }

  try {
    const existing = await prisma.workspaceCustomRole.findFirst({
      where: {
        id: roleId,
        clientId: access.activeClientId,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            memberships: true,
            invitations: {
              where: { status: "pending" },
            },
          },
        },
      },
    });

    if (!existing) {
      return jsonResponse(
        { ok: false, message: "The role could not be found." },
        404,
      );
    }

    if (existing._count.memberships > 0 || existing._count.invitations > 0) {
      const assigned = existing._count.memberships + existing._count.invitations;
      return jsonResponse(
        {
          ok: false,
          message: `Reassign ${assigned} ${
            assigned === 1 ? "person" : "people"
          } before deleting this role.`,
        },
        409,
      );
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.workspaceCustomRole.delete({
        where: { id: existing.id },
      });

      await transaction.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId: access.activeClientId,
          action: "workspace_custom_role_deleted",
          entityType: "WorkspaceCustomRole",
          entityId: existing.id,
          metadata: {
            note: `Deleted custom role ${existing.name}.`,
          },
        },
      });
    });

    return jsonResponse({ ok: true, message: "The role was deleted." }, 200);
  } catch (error) {
    console.error(
      "[team-roles] Delete failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { ok: false, message: "The role could not be deleted." },
      500,
    );
  }
}
