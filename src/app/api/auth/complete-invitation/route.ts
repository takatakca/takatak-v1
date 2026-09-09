import {
    NextRequest,
    NextResponse,
  } from "next/server";
  import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
  import { validateInvitationCompletion } from "@/lib/auth/invitation-completion-validation";
  import { getPrisma } from "@/lib/db/prisma";
  import { wrapAuthRoute } from "@/lib/auth/auth-json";
  
  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";
  
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
  
  async function handleCompleteInvitation(
    request: NextRequest,
  ): Promise<NextResponse> {
    const supabase =
      await createSupabaseServerClient();
  
    const prisma = getPrisma();
  
    if (!supabase || !prisma) {
      return jsonResponse(
        {
          ok: false,
          message:
            "The account service is temporarily unavailable.",
        },
        503,
      );
    }
  
    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();
  
    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Authentication is required.",
        },
        401,
      );
    }
  
    const wasCreatedByInvitation =
        typeof user.invited_at === "string" &&
        user.invited_at.length > 0;

    const invitationAlreadyCompleted =
        user.user_metadata
            ?.invitation_completed === true;

    if (!wasCreatedByInvitation) {
        return jsonResponse(
            {
            ok: false,
            message:
                "This account does not require invited-account setup.",
            },
            403,
        );
    }

    if (invitationAlreadyCompleted) {
        return jsonResponse(
            {
            ok: false,
            message:
                "This invited account has already been completed.",
            redirectTo: "/dashboard",
            },
            409,
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
            "The account completion request is invalid.",
        },
        400,
      );
    }
  
    const validation =
      validateInvitationCompletion(body);
  
    if (!validation.success) {
      return jsonResponse(
        {
          ok: false,
          message: validation.message,
          fieldErrors:
            validation.fieldErrors,
        },
        400,
      );
    }
  
    try {
      const profile =
        await prisma.profile.findUnique({
          where: {
            authUserId: user.id,
          },
          select: {
            id: true,
            status: true,
            memberships: {
              where: {
                status: "active",
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                clientId: true,
              },
            },
          },
        });
  
      if (!profile) {
        return jsonResponse(
          {
            ok: false,
            message:
              "Your application profile could not be found.",
          },
          404,
        );
      }
  
      if (profile.status === "disabled") {
        return jsonResponse(
          {
            ok: false,
            message:
              "This account has been disabled.",
          },
          403,
        );
      }
  
      if (
        profile.memberships.length === 0
      ) {
        return jsonResponse(
          {
            ok: false,
            message:
              "No active workspace invitation could be found for this account.",
          },
          403,
        );
      }
  
      const {
        firstName,
        lastName,
        displayName,
        password,
      } = validation.data;
  
      const completedAt =
        new Date().toISOString();
  
      const {
        error: authUpdateError,
      } = await supabase.auth.updateUser({
        password,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: displayName,
          display_name: displayName,
          invitation_completed: true,
          invitation_completed_at:
            completedAt,
        },
      });
  
      if (authUpdateError) {
        console.error(
          "[complete-invitation] Supabase account update failed:",
          authUpdateError.message,
        );
  
        return jsonResponse(
          {
            ok: false,
            message:
              "Your password and authentication profile could not be updated.",
          },
          502,
        );
      }
  
      const clientId =
        profile.memberships[0].clientId;
  
      const updatedProfile =
        await prisma.$transaction(
          async (transaction) => {
            const updated =
              await transaction.profile.update({
                where: {
                  id: profile.id,
                },
                data: {
                  firstName,
                  lastName,
                  displayName,
                  status: "active",
                },
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  status: true,
                },
              });
  
            await transaction.auditLog.create({
              data: {
                profileId: profile.id,
                clientId,
                action:
                  "invited_account_completed",
                entityType: "Profile",
                entityId: profile.id,
                metadata: {
                  note: `${displayName} completed their invited account setup.`,
                },
              },
            });
  
            return updated;
          },
        );
  
      return jsonResponse(
        {
          ok: true,
          message:
            "Your account setup was completed successfully.",
          redirectTo: "/dashboard",
          profile: updatedProfile,
        },
        200,
      );
    } catch (error) {
      console.error(
        "[complete-invitation] Account completion failed:",
        error instanceof Error
          ? error.message
          : "Unknown error",
      );
  
      return jsonResponse(
        {
          ok: false,
          message:
            "Your account setup could not be completed.",
        },
        500,
      );
    }
  }

export const PATCH = wrapAuthRoute(
  "complete-invitation",
  "The account service is temporarily unavailable.",
  handleCompleteInvitation,
);