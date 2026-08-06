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
      invitationId: string;
    }>;
  },
): Promise<NextResponse> {
  const { invitationId } = await context.params;
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

  if (!hasEffectivePermission(access, "invite_users")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to manage invitations.",
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
    const invitation =
      await prisma.userInvitation.findFirst({
        where: {
          id: invitationId,
          clientId: access.activeClientId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      });

    if (!invitation) {
      return jsonResponse(
        {
          ok: false,
          message: "The invitation could not be found.",
        },
        404,
      );
    }

    if (
      ROLE_LEVELS[invitation.role] >
      ROLE_LEVELS[access.role]
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot delete an invitation with a higher role.",
        },
        403,
      );
    }

    if (
      invitation.role === "owner" &&
      access.role !== "owner"
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Only an owner can delete an Owner invitation.",
        },
        403,
      );
    }

    if (invitation.status === "pending") {
      return jsonResponse(
        {
          ok: false,
          message:
            "Revoke the pending invitation before deleting it.",
        },
        409,
      );
    }

    if (invitation.status === "accepted") {
      return jsonResponse(
        {
          ok: false,
          message:
            "Accepted invitations are retained as membership history.",
        },
        409,
      );
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId: access.activeClientId,
          action: "user_invitation_deleted",
          entityType: "UserInvitation",
          entityId: invitation.id,
          metadata: {
            note: `The ${invitation.status} invitation for ${invitation.email} was permanently deleted.`,
            deletedStatus: invitation.status,
            invitedRole: invitation.role,
          },
        },
      });

      await transaction.userInvitation.delete({
        where: {
          id: invitation.id,
        },
      });
    });

    return jsonResponse(
      {
        ok: true,
        message:
          "The invitation record was permanently deleted.",
      },
      200,
    );
  } catch (error) {
    console.error(
      "[team-invitation-delete] Invitation deletion failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "The invitation record could not be deleted.",
      },
      500,
    );
  }
}