import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { validateAccountSettingsInput } from "@/lib/account/account-settings-validation";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
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

  if (
    access.mode !== "client_scoped" &&
    access.mode !== "platform_admin"
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Your account profile could not be resolved.",
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
        message: "The account settings request is invalid.",
      },
      400,
    );
  }

  const validation = validateAccountSettingsInput(body);

  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message: validation.message,
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  const prisma = getPrisma();
  const supabase = await createSupabaseServerClient();

  if (!prisma || !supabase) {
    return jsonResponse(
      {
        ok: false,
        message: "The profile service is temporarily unavailable.",
      },
      503,
    );
  }

  const {
    firstName,
    lastName,
    displayName,
    language,
    timezone,
    weekStartsOn,
    monthlySummaryEnabled,
    monthlySummaryEmail,
  } = validation.data;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          message: "Your authenticated account could not be verified.",
        },
        401,
      );
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: displayName,
        display_name: displayName,
      },
    });

    if (metadataError) {
      console.error(
        "[account-profile] Supabase metadata update failed:",
        metadataError.message,
      );

      return jsonResponse(
        {
          ok: false,
          message: "Your authentication profile could not be updated.",
        },
        502,
      );
    }

    const updatedProfile = await prisma.$transaction(async (transaction) => {
      const profile = await transaction.profile.update({
        where: {
          id: access.profileId,
        },
        data: {
          firstName,
          lastName: lastName || null,
          displayName,
          language,
          timezone,
          weekStartsOn,
          monthlySummaryEnabled,
          monthlySummaryEmail,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          language: true,
          timezone: true,
          weekStartsOn: true,
          monthlySummaryEnabled: true,
          monthlySummaryEmail: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId:
            access.mode === "client_scoped" ? access.activeClientId : null,
          action: "account_profile_updated",
          entityType: "Profile",
          entityId: access.profileId,
          metadata: {
            note: `${displayName} updated their account settings.`,
          },
        },
      });

      return profile;
    });

    return jsonResponse(
      {
        ok: true,
        message: "Your account settings were saved.",
        profile: updatedProfile,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "account-profile",
      error,
      "Your account settings could not be updated.",
    );
  }
}
