import { NextRequest } from "next/server";

import { validateAccountAccessInput } from "@/lib/account/account-access-validation";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { originFromRequest } from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
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

  const bodyResult = await readJsonBody(request);

  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateAccountAccessInput(bodyResult.body);

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
  const supabase = await createSupabaseServerClient({
    persistSessionCookies: true,
  });

  if (!prisma || !supabase) {
    return jsonResponse(
      { ok: false, message: "Access settings are temporarily unavailable." },
      503,
    );
  }

  const { email, newPassword } = validation.data;

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: access.profileId },
      select: {
        id: true,
        email: true,
        authUserId: true,
        displayName: true,
      },
    });

    if (!profile) {
      return jsonResponse(
        { ok: false, message: "Your account profile could not be found." },
        404,
      );
    }

    if (email === null && profile.email) {
      return jsonResponse(
        {
          ok: false,
          message: "Enter an email address, or leave your current email unchanged.",
          fieldErrors: {
            email: "Enter an email address, or leave your current email unchanged.",
          },
        },
        400,
      );
    }

    const emailChanged = email !== null && email !== profile.email;
    if (!emailChanged && !newPassword) {
      return jsonResponse(
        { ok: false, message: "There are no access changes to save." },
        400,
      );
    }

    if (email && emailChanged) {
      const [takenProfile, takenIdentity] = await Promise.all([
        prisma.profile.findFirst({
          where: {
            email,
            id: { not: profile.id },
          },
          select: { id: true },
        }),
        prisma.masterIdentity.findFirst({
          where: {
            primaryEmail: email,
            NOT: { profileId: profile.id },
          },
          select: { id: true },
        }),
      ]);

      if (takenProfile || takenIdentity) {
        return jsonResponse(
          {
            ok: false,
            message: "An account already exists for this email address.",
            fieldErrors: {
              email: "An account already exists for this email address.",
            },
          },
          409,
        );
      }
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user || user.id !== profile.authUserId) {
      return jsonResponse(
        { ok: false, message: "Please sign in again." },
        401,
      );
    }

    if (emailChanged || newPassword) {
      const { error: authError } = await supabase.auth.updateUser(
        {
          ...(emailChanged && email ? { email } : {}),
          ...(newPassword ? { password: newPassword } : {}),
        },
        emailChanged
          ? {
              emailRedirectTo: `${originFromRequest(request)}/auth/callback?next=/dashboard/account`,
            }
          : undefined,
      );

      if (authError) {
        console.error(
          "[account-access] Auth identity update failed:",
          authError.message,
        );

        return jsonResponse(
          {
            ok: false,
            message:
              authError.message.toLowerCase().includes("password")
                ? "The new password could not be saved."
                : "The confirmation message could not be sent.",
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
        action: emailChanged
          ? "account_email_verification_requested"
          : "account_password_updated",
        entityType: "Profile",
        entityId: profile.id,
        metadata: {
          emailChangeRequested: emailChanged,
          passwordChanged: Boolean(newPassword),
        },
      },
    });

    return jsonResponse(
      {
        ok: true,
        message: emailChanged
          ? newPassword
            ? "Your password was updated. Confirm the new email from the message we sent before it can be used."
            : "Check the new email and confirm it before it can be used."
          : "Your password was updated.",
        email: profile.email,
        verificationPending: emailChanged,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "account-access",
      error,
      "Access settings could not be saved.",
    );
  }
}
