import { NextRequest } from "next/server";

import { validateAccountAccessInput } from "@/lib/account/account-access-validation";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { isPrismaKnownRequestError } from "@/lib/db/prisma-errors";
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
  const admin = getSupabaseAdminClient();

  if (!prisma || !admin) {
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

    const emailChanged = email !== profile.email;
    if (!emailChanged && !newPassword) {
      return jsonResponse(
        { ok: false, message: "There are no access changes to save." },
        400,
      );
    }

    if (emailChanged) {
      const taken = await prisma.profile.findFirst({
        where: {
          email,
          id: { not: profile.id },
        },
        select: { id: true },
      });

      if (taken) {
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

    if (emailChanged || newPassword) {
      const { error: authError } = await admin.auth.admin.updateUserById(
        profile.authUserId,
        {
          ...(emailChanged ? { email, email_confirm: true } : {}),
          ...(newPassword ? { password: newPassword } : {}),
        },
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
                : "The email address could not be updated.",
          },
          502,
        );
      }
    }

    if (emailChanged) {
      try {
        await prisma.$transaction(async (transaction) => {
          await transaction.profile.update({
            where: { id: profile.id },
            data: { email },
          });

          await transaction.auditLog.create({
            data: {
              profileId: access.profileId,
              clientId:
                access.mode === "client_scoped"
                  ? access.activeClientId
                  : null,
              action: "account_access_updated",
              entityType: "Profile",
              entityId: profile.id,
              metadata: {
                note: `${profile.displayName ?? email} updated their sign-in email.`,
              },
            },
          });
        });
      } catch (error) {
        if (isPrismaKnownRequestError(error) && error.code === "P2002") {
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
        throw error;
      }
    } else {
      await prisma.auditLog.create({
        data: {
          profileId: access.profileId,
          clientId:
            access.mode === "client_scoped" ? access.activeClientId : null,
          action: "account_password_updated",
          entityType: "Profile",
          entityId: profile.id,
          metadata: {
            note: `${profile.displayName ?? profile.email} updated their password.`,
          },
        },
      });
    }

    return jsonResponse(
      {
        ok: true,
        message: emailChanged
          ? "Your sign-in email was updated."
          : "Your password was updated.",
        email,
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
