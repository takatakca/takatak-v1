import { NextRequest } from "next/server";

import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthUserMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const code =
    typeof candidate.code === "string" ? candidate.code.toLowerCase() : "";
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
) {
  const { access } = await getServerAccessContext();

  if (
    access.mode === "denied" &&
    access.reason === "not_authenticated"
  ) {
    return jsonResponse(
      { ok: false, message: "Authentication is required." },
      401,
    );
  }

  if (
    access.mode !== "client_scoped" &&
    access.mode !== "platform_admin"
  ) {
    return jsonResponse(
      { ok: false, message: "Your account profile could not be resolved." },
      403,
    );
  }

  const prisma = getPrisma();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!prisma || !supabaseAdmin) {
    return jsonResponse(
      {
        ok: false,
        message: "Account deletion is temporarily unavailable.",
      },
      503,
    );
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: access.profileId },
      select: {
        id: true,
        email: true,
        displayName: true,
        authUserId: true,
        role: true,
        status: true,
        memberships: {
          where: { role: "owner" },
          select: {
            clientId: true,
            client: { select: { name: true } },
          },
        },
      },
    });

    if (!profile) {
      return jsonResponse(
        { ok: false, message: "Your account profile could not be found." },
        404,
      );
    }

    if (profile.memberships.length > 0) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Transfer ownership of your workspaces before deleting this account.",
          ownedWorkspaces: profile.memberships.map((membership) => ({
            clientId: membership.clientId,
            name: membership.client.name,
          })),
        },
        409,
      );
    }

    if (profile.role === "owner") {
      const activePlatformOwnerCount = await prisma.profile.count({
        where: {
          role: "owner",
          status: { not: "disabled" },
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

    if (profile.status !== "disabled") {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { status: "disabled" },
      });
    }

    const { data: authLookup, error: authLookupError } =
      await supabaseAdmin.auth.admin.getUserById(profile.authUserId);

    if (authLookupError && !isAuthUserMissing(authLookupError)) {
      console.error(
        "[account-delete] Supabase user lookup failed:",
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
      const { error: authDeleteError } =
        await supabaseAdmin.auth.admin.deleteUser(profile.authUserId, false);

      if (authDeleteError) {
        console.error(
          "[account-delete] Supabase user deletion failed:",
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

    await prisma.auditLog.create({
      data: {
        profileId: access.profileId,
        clientId:
          access.mode === "client_scoped" ? access.activeClientId : null,
        action: "account_self_deleted",
        entityType: "Profile",
        entityId: profile.id,
        metadata: {
          note: `${profile.displayName ?? profile.email} deleted their TAKATAK account.`,
        },
      },
    });

    return jsonResponse(
      {
        ok: true,
        message: "Your account was deleted.",
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "account-delete",
      error,
      "Your account could not be deleted.",
    );
  }
}
