import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import {
  type Permission,
  type RoleKey,
} from "@/lib/security/roles";
import { generateInvitationToken } from "@/lib/team/invitation-token";
import { validateInvitationInput } from "@/lib/team/invitation-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVITATION_LIFETIME_DAYS = 7;

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

function getApplicationOrigin(request: NextRequest): string {
  const configuredApplicationUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredApplicationUrl) {
    try {
      const configuredUrl = new URL(
        configuredApplicationUrl,
      );

      if (
        configuredUrl.protocol === "https:" ||
        configuredUrl.hostname === "localhost"
      ) {
        return configuredUrl.origin;
      }
    } catch {
      // Fall back to the verified request origin.
    }
  }

  return request.nextUrl.origin;
}

function containsPermissionEscalation(
  permissions: Permission[],
  access: Parameters<
    typeof hasEffectivePermission
  >[0],
): boolean {
  return permissions.some(
    (permission) =>
      !hasEffectivePermission(access, permission),
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
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
        message:
          "Select a workspace before sending an invitation.",
      },
      403,
    );
  }

  if (!hasEffectivePermission(access, "invite_users")) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to invite users.",
      },
      403,
    );
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "The invitation request is invalid.",
      },
      400,
    );
  }

  const validation =
    validateInvitationInput(requestBody);

  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message: validation.error,
      },
      400,
    );
  }

  const {
    email,
    role,
    customPermissions,
    deniedPermissions,
  } = validation.data;

  if (ROLE_LEVELS[role] > ROLE_LEVELS[access.role]) {
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
    role === "owner" &&
    access.role !== "owner"
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Only a workspace owner can invite another owner.",
      },
      403,
    );
  }

  const includesCustomPermissionChanges =
    customPermissions.length > 0 ||
    deniedPermissions.length > 0;

  if (
    includesCustomPermissionChanges &&
    !hasEffectivePermission(
      access,
      "manage_permissions",
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You do not have permission to customize user permissions.",
      },
      403,
    );
  }

  if (
    containsPermissionEscalation(
      customPermissions,
      access,
    )
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "You cannot grant permissions that you do not have.",
      },
      403,
    );
  }

  const prisma = getPrisma();
  const supabaseAdmin = getSupabaseAdminClient();

  if (!prisma || !supabaseAdmin) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The invitation service is unavailable.",
      },
      503,
    );
  }

  try {
    const [workspace, invitingProfile] =
      await Promise.all([
        prisma.client.findUnique({
          where: {
            id: access.activeClientId,
          },
          select: {
            id: true,
            name: true,
          },
        }),
        prisma.profile.findUnique({
          where: {
            id: access.profileId,
          },
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        }),
      ]);

    if (!workspace || !invitingProfile) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The workspace or inviting user could not be found.",
        },
        404,
      );
    }

    if (
      invitingProfile.email?.toLowerCase() === email
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "You are already a member of this workspace.",
        },
        409,
      );
    }

    const existingMembership =
      await prisma.clientMembership.findFirst({
        where: {
          clientId: access.activeClientId,
          profile: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
        },
        select: {
          id: true,
        },
      });

    if (existingMembership) {
      return jsonResponse(
        {
          ok: false,
          message:
            "This user is already a workspace member.",
        },
        409,
      );
    }

    const { token, tokenHash } =
      generateInvitationToken();

    const expiresAt = new Date(
      Date.now() +
        INVITATION_LIFETIME_DAYS *
          24 *
          60 *
          60 *
          1000,
    );

    const invitation =
      await prisma.userInvitation.upsert({
        where: {
          clientId_email: {
            clientId: access.activeClientId,
            email,
          },
        },
        create: {
          clientId: access.activeClientId,
          email,
          role,
          status: "pending",
          tokenHash,
          customPermissions,
          deniedPermissions,
          invitedByProfileId: access.profileId,
          expiresAt,
        },
        update: {
          role,
          status: "pending",
          tokenHash,
          customPermissions,
          deniedPermissions,
          invitedByProfileId: access.profileId,
          expiresAt,
          acceptedAt: null,
          revokedAt: null,
        },
        select: {
          id: true,
        },
      });

      const callbackUrl = new URL(
        `/auth/callback/invite/${encodeURIComponent(token)}`,
        getApplicationOrigin(request),
      );
      
      callbackUrl.searchParams.set(
        "flow",
        "invite",
      );

    let deliveryMethod: "invite" | "magiclink" =
    "invite";

    let deliveryError: {
    message: string;
    } | null = null;

    const { error: invitationError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
        redirectTo: callbackUrl.toString(),
        data: {
            invited_workspace_name: workspace.name,
        },
        },
    );

    if (invitationError) {
    const errorCode =
        typeof invitationError === "object" &&
        invitationError !== null &&
        "code" in invitationError &&
        typeof invitationError.code === "string"
        ? invitationError.code
        : null;

    const emailAlreadyExists =
        errorCode === "email_exists" ||
        errorCode === "user_already_exists" ||
        invitationError.message
        .toLowerCase()
        .includes("already been registered");

    if (emailAlreadyExists) {
        deliveryMethod = "magiclink";

        const { error: magicLinkError } =
        await supabaseAdmin.auth.signInWithOtp({
            email,
            options: {
            shouldCreateUser: false,
            emailRedirectTo:
                callbackUrl.toString(),
            },
        });

        deliveryError = magicLinkError;
    } else {
        deliveryError = invitationError;
    }
    }

    if (deliveryError) {
    console.error(
        `[team-invitations] ${deliveryMethod} delivery failed:`,
        deliveryError.message,
    );

    await prisma.userInvitation.update({
        where: {
        id: invitation.id,
        },
        data: {
        status: "revoked",
        revokedAt: new Date(),
        },
    });

    await prisma.auditLog.create({
        data: {
        profileId: access.profileId,
        clientId: access.activeClientId,
        action: "user_invitation_failed",
        entityType: "UserInvitation",
        entityId: invitation.id,
        metadata: {
            note: `Invitation delivery failed for ${email}.`,
            deliveryMethod,
        },
        },
    });

    return jsonResponse(
        {
        ok: false,
        message:
            "The invitation email could not be sent.",
        },
        502,
    );
    }

    // const { error: invitationError } =
    //   await supabaseAdmin.auth.admin.inviteUserByEmail(
    //     email,
    //     {
    //       redirectTo: callbackUrl.toString(),
    //       data: {
    //         invited_workspace_name: workspace.name,
    //       },
    //     },
    //   );

    // if (invitationError) {
    //   console.error(
    //     "[team-invitations] Supabase invitation failed:",
    //     invitationError.message,
    //   );

    //   await prisma.userInvitation.update({
    //     where: {
    //       id: invitation.id,
    //     },
    //     data: {
    //       status: "revoked",
    //       revokedAt: new Date(),
    //     },
    //   });

    //   await prisma.auditLog.create({
    //     data: {
    //       profileId: access.profileId,
    //       clientId: access.activeClientId,
    //       action: "user_invitation_failed",
    //       entityType: "UserInvitation",
    //       entityId: invitation.id,
    //       metadata: {
    //         note: `Invitation delivery failed for ${email}.`,
    //       },
    //     },
    //   });

    //   return jsonResponse(
    //     {
    //       ok: false,
    //       message:
    //         "The invitation email could not be sent.",
    //     },
    //     502,
    //   );
    // }

    await prisma.auditLog.create({
      data: {
        profileId: access.profileId,
        clientId: access.activeClientId,
        action: "user_invitation_sent",
        entityType: "UserInvitation",
        entityId: invitation.id,
        metadata: {
          note: `${email} was invited to ${workspace.name} as ${role}.`,
        },
      },
    });

    return jsonResponse(
      {
        ok: true,
        message:
          "The workspace invitation was sent successfully.",
        invitationId: invitation.id,
      },
      201,
    );
  } catch (error) {
    console.error(
      "[team-invitations] Invitation creation failed:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return jsonResponse(
      {
        ok: false,
        message:
          "The invitation could not be created.",
      },
      500,
    );
  }
}