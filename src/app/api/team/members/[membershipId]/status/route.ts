import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { RoleKey } from "@/lib/security/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MembershipStatusInput = "active" | "suspended";

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

function isMembershipStatus(
  value: unknown,
): value is MembershipStatusInput {
  return value === "active" || value === "suspended";
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
    !hasEffectivePermission(access, "suspend_users")
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to suspend or reactivate members.",
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
        message:
          "The membership status request is invalid.",
      },
      400,
    );
  }

  const requestedStatus =
    typeof body === "object" &&
    body !== null &&
    "status" in body
      ? (body as { status: unknown }).status
      : null;

  if (!isMembershipStatus(requestedStatus)) {
    return jsonResponse(
      {
        ok: false,
        message: "Select a valid membership status.",
      },
      400,
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

    if (
      targetMembership.profileId === access.profileId
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot suspend your own workspace access.",
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
      requestedStatus === "suspended" &&
      targetMembership.role === "owner"
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

    if (targetMembership.status === requestedStatus) {
      return jsonResponse(
        {
          ok: true,
          message:
            requestedStatus === "active"
              ? "The member is already active."
              : "The member is already suspended.",
        },
        200,
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
                status: requestedStatus,
              },
              select: {
                id: true,
                status: true,
              },
            });

          const memberName =
            targetMembership.profile.displayName ??
            targetMembership.profile.email ??
            "Workspace member";

          await transaction.auditLog.create({
            data: {
              profileId: access.profileId,
              clientId: access.activeClientId,
              action:
                requestedStatus === "suspended"
                  ? "workspace_member_suspended"
                  : "workspace_member_reactivated",
              entityType: "ClientMembership",
              entityId: targetMembership.id,
              metadata: {
                note:
                  requestedStatus === "suspended"
                    ? `${memberName} was suspended from the workspace.`
                    : `${memberName} was reactivated in the workspace.`,
                previousStatus:
                  targetMembership.status,
                newStatus: requestedStatus,
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
          requestedStatus === "suspended"
            ? "The workspace member was suspended."
            : "The workspace member was reactivated.",
        membership: updatedMembership,
      },
      200,
    );
  } catch (error) {
    console.error(
      "[team-status] Membership status update failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "The membership status could not be updated.",
      },
      500,
    );
  }
}