import { NextRequest, NextResponse } from "next/server";
import { assertClientCanInviteTeam } from "@/lib/billing/social/entitlement-gates";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import {
  isRoleKey,
  type RoleKey,
} from "@/lib/security/roles";
import { isServiceError } from "@/lib/services/service-error";

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

  if (!hasEffectivePermission(access, "manage_roles")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to manage roles.",
      },
      403,
    );
  }

  try {
    await assertClientCanInviteTeam(access.activeClientId);
  } catch (error) {
    if (isServiceError(error)) {
      return jsonResponse(
        { ok: false, message: error.message },
        error.status,
      );
    }
    throw error;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "The role request is invalid.",
      },
      400,
    );
  }

  const requestedRole =
    typeof body === "object" &&
    body !== null &&
    "role" in body
      ? (body as { role: unknown }).role
      : null;

  if (!isRoleKey(requestedRole)) {
    return jsonResponse(
      {
        ok: false,
        message: "Select a valid workspace role.",
      },
      400,
    );
  }

  if (
    ROLE_LEVELS[requestedRole] >
    ROLE_LEVELS[access.role]
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You cannot assign a role higher than your own.",
      },
      403,
    );
  }

  if (
    requestedRole === "owner" &&
    access.role !== "owner"
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Only a workspace owner can assign the Owner role.",
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
          status: true,
          profile: {
            select: {
              email: true,
              displayName: true,
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

    if (targetMembership.profileId === access.profileId) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot change your own workspace role.",
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

    if (
      targetMembership.role === "owner" &&
      access.role !== "owner"
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Only an owner can modify another owner.",
        },
        403,
      );
    }

    if (
      targetMembership.role === "owner" &&
      requestedRole !== "owner"
    ) {
      const activeOwnerCount =
        await prisma.clientMembership.count({
          where: {
            clientId: access.activeClientId,
            role: "owner",
            status: "active",
          },
        });

      if (activeOwnerCount <= 1) {
        return jsonResponse(
          {
            ok: false,
            message:
              "The workspace must keep at least one active owner.",
          },
          409,
        );
      }
    }

    if (targetMembership.role === requestedRole) {
      return jsonResponse(
        {
          ok: true,
          message:
            "The member already has this workspace role.",
        },
        200,
      );
    }

    const updatedMembership =
      await prisma.$transaction(async (transaction) => {
        const membership =
          await transaction.clientMembership.update({
            where: {
              id: targetMembership.id,
            },
            data: {
              role: requestedRole,
            },
            select: {
              id: true,
              role: true,
            },
          });

        await transaction.auditLog.create({
          data: {
            profileId: access.profileId,
            clientId: access.activeClientId,
            action: "workspace_member_role_changed",
            entityType: "ClientMembership",
            entityId: targetMembership.id,
            metadata: {
              note: `${
                targetMembership.profile.displayName ??
                targetMembership.profile.email ??
                "Workspace member"
              } changed from ${targetMembership.role} to ${requestedRole}.`,
              previousRole: targetMembership.role,
              newRole: requestedRole,
            },
          },
        });

        return membership;
      });

    return jsonResponse(
      {
        ok: true,
        message:
          "The workspace role was updated successfully.",
        membership: updatedMembership,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[team-role] Role update failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "The workspace role could not be updated.",
      },
      500,
    );
  }
}