import {
    NextRequest,
    NextResponse,
  } from "next/server";
  import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
  import { getPrisma } from "@/lib/db/prisma";
  import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";
  
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  
  const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  function jsonResponse(
    body: Record<string, unknown>,
    status: number,
  ): NextResponse {
    const response = NextResponse.json(body, {
      status,
    });
  
    response.headers.set(
      "Cache-Control",
      "no-store",
    );
  
    return response;
  }
  
  function isAuthUserMissing(
    error: unknown,
  ): boolean {
    if (
      typeof error !== "object" ||
      error === null
    ) {
      return false;
    }
  
    const candidate = error as {
      code?: unknown;
      message?: unknown;
    };
  
    const code =
      typeof candidate.code === "string"
        ? candidate.code.toLowerCase()
        : "";
  
    const message =
      typeof candidate.message === "string"
        ? candidate.message.toLowerCase()
        : "";
  
    return (
      code === "user_not_found" ||
      message.includes("user not found") ||
      message.includes("does not exist")
    );
  }
  
  export async function DELETE(
    _request: NextRequest,
    context: {
      params: Promise<{
        profileId: string;
      }>;
    },
  ): Promise<NextResponse> {
    const { profileId } =
      await context.params;

    const access =
      await getPlatformAdminAccess();

    if (
      access.mode === "denied" &&
      access.reason ===
        "not_authenticated"
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Authentication is required.",
        },
        401,
      );
    }

    if (
      access.mode === "denied" &&
      access.reason ===
        "database_unavailable"
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Platform access could not be verified.",
        },
        503,
      );
    }

    if (
      access.mode !== "authorized" ||
      access.role !== "owner"
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Only a Platform Owner can permanently delete users.",
        },
        403,
      );
    }
  
    if (!UUID_PATTERN.test(profileId)) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The selected user identifier is invalid.",
        },
        400,
      );
    }
  
    if (profileId === access.profileId) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You cannot permanently delete your own account.",
        },
        409,
      );
    }
  
    const prisma = getPrisma();
    const supabaseAdmin =
      getSupabaseAdminClient();
  
    if (!prisma || !supabaseAdmin) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The platform account service is temporarily unavailable.",
        },
        503,
      );
    }
  
    try {
      const targetProfile =
        await prisma.profile.findUnique({
          where: {
            id: profileId,
          },
          select: {
            id: true,
            authUserId: true,
            email: true,
            displayName: true,
            role: true,
            status: true,
            memberships: {
              select: {
                id: true,
                clientId: true,
                role: true,
                status: true,
                client: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });
  
      if (!targetProfile) {
        return jsonResponse(
          {
            ok: false,
            message:
              "The selected user could not be found.",
          },
          404,
        );
      }
  
      const ownedWorkspaces =
        targetProfile.memberships.filter(
          (membership) =>
            membership.role === "owner",
        );
  
      if (ownedWorkspaces.length > 0) {
        return jsonResponse(
          {
            ok: false,
            message:
              "This user owns one or more workspaces. Transfer ownership or delete those workspaces before deleting the account.",
            ownedWorkspaces:
              ownedWorkspaces.map(
                (membership) => ({
                  clientId:
                    membership.clientId,
                  name:
                    membership.client.name,
                }),
              ),
          },
          409,
        );
      }
  
      if (targetProfile.role === "owner") {
        const activePlatformOwnerCount =
          await prisma.profile.count({
            where: {
              role: "owner",
              status: {
                not: "disabled",
              },
            },
          });
  
        if (activePlatformOwnerCount <= 1) {
          return jsonResponse(
            {
              ok: false,
              message:
                "The platform must keep at least one active Platform Owner.",
            },
            409,
          );
        }
      }
  
      /*
       * Disable the database profile before calling the
       * external authentication service. This immediately
       * blocks application access if external deletion or
       * cleanup is interrupted.
       */
      if (
        targetProfile.status !== "disabled"
      ) {
        await prisma.profile.update({
          where: {
            id: targetProfile.id,
          },
          data: {
            status: "disabled",
          },
        });
      }
  
      const {
        data: authLookup,
        error: authLookupError,
      } =
        await supabaseAdmin.auth.admin.getUserById(
          targetProfile.authUserId,
        );
  
      if (
        authLookupError &&
        !isAuthUserMissing(authLookupError)
      ) {
        console.error(
          "[admin-user-delete] Supabase user lookup failed:",
          authLookupError.message,
        );
  
        return jsonResponse(
          {
            ok: false,
            message:
              "The account was disabled, but the authentication service could not be reached. Retry the deletion.",
          },
          502,
        );
      }
  
      if (authLookup?.user) {
        const {
          error: authDeleteError,
        } =
          await supabaseAdmin.auth.admin.deleteUser(
            targetProfile.authUserId,
            false,
          );
  
        if (authDeleteError) {
          console.error(
            "[admin-user-delete] Supabase user deletion failed:",
            authDeleteError.message,
          );
  
          return jsonResponse(
            {
              ok: false,
              message:
                "The account was disabled, but its authentication identity could not be deleted. Retry the deletion.",
            },
            502,
          );
        }
      }
  
      const deletedName =
        targetProfile.displayName ??
        targetProfile.email;
  
      await prisma.$transaction(
        async (transaction) => {
          await transaction.auditLog.create({
            data: {
              profileId: access.profileId,
              clientId: null,
              action:
                "platform_user_deleted",
              entityType: "Profile",
              entityId:
                targetProfile.id,
              metadata: {
                note: `${deletedName} was permanently deleted from the platform.`,
                deletedEmail:
                  targetProfile.email,
                deletedPlatformRole:
                  targetProfile.role,
                removedMembershipCount:
                  targetProfile.memberships
                    .length,
              },
            },
          });
  
          await transaction.profile.delete({
            where: {
              id: targetProfile.id,
            },
          });
        },
      );
  
      return jsonResponse(
        {
          ok: true,
          message:
            "The user account was permanently deleted.",
          deletedProfileId:
            targetProfile.id,
        },
        200,
      );
    } catch (error) {
      console.error(
        "[admin-user-delete] Permanent deletion failed:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
  
      return jsonResponse(
        {
          ok: false,
          message:
            "The user account could not be completely deleted. The account remains blocked from application access.",
        },
        500,
      );
    }
  }