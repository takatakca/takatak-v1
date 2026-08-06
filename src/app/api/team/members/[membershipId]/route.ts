import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { RoleKey } from "@/lib/security/roles";

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

export async function DELETE(
  _request: NextRequest,
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

  if (!hasEffectivePermission(access, "delete_users")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to remove workspace members.",
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

    if (targetMembership.profileId === access.profileId) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot remove your own workspace membership here.",
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
            "You cannot remove a member with a higher role.",
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
            "Only an owner can remove another owner.",
        },
        403,
      );
    }

    if (targetMembership.role === "owner") {
      const activeOwnerCount =
        await prisma.clientMembership.count({
          where: {
            clientId: access.activeClientId,
            role: "owner",
            status: "active",
          },
        });

      if (
        targetMembership.status === "active" &&
        activeOwnerCount <= 1
      ) {
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

    const memberName =
      targetMembership.profile.displayName ??
      targetMembership.profile.email ??
      "Workspace member";

    await prisma.$transaction(async (transaction) => {
      await transaction.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId: access.activeClientId,
          action: "workspace_member_removed",
          entityType: "ClientMembership",
          entityId: targetMembership.id,
          metadata: {
            note: `${memberName} was removed from the workspace.`,
            removedProfileId: targetMembership.profileId,
            removedRole: targetMembership.role,
            removedStatus: targetMembership.status,
          },
        },
      });

      await transaction.clientMembership.delete({
        where: {
          id: targetMembership.id,
        },
      });
    });

    return jsonResponse(
      {
        ok: true,
        message:
          "The member was removed from this workspace. Their account was not deleted.",
      },
      200,
    );
  } catch (error) {
    console.error(
      "[team-member-delete] Membership removal failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "The workspace member could not be removed.",
      },
      500,
    );
  }
}