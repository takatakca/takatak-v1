import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { isRecord } from "@/lib/validation/common";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mfaUnavailableMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("not enabled") ||
    lower.includes("mfa") && lower.includes("disabled") ||
    lower.includes("feature not available")
  ) {
    return "Authenticator 2FA is not enabled on this authentication project yet.";
  }
  return message;
}

export async function POST(request: NextRequest) {
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

  if (!isRecord(bodyResult.body)) {
    return jsonResponse(
      { ok: false, message: "The 2FA request is invalid." },
      400,
    );
  }

  const action = bodyResult.body.action;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return jsonResponse(
      { ok: false, message: "Two-factor authentication is temporarily unavailable." },
      503,
    );
  }

  try {
    if (action === "enroll") {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TAKATAK authenticator",
      });

      if (error || !data || !data.totp?.qr_code) {
        return jsonResponse(
          {
            ok: false,
            message: mfaUnavailableMessage(
              error?.message ?? "Authenticator enrollment could not start.",
            ),
          },
          400,
        );
      }

      return jsonResponse(
        {
          ok: true,
          factorId: data.id,
          qrCode: data.totp?.qr_code ?? "",
          secret: data.totp?.secret ?? "",
        },
        200,
      );
    }

    if (action === "verify") {
      const factorId =
        typeof bodyResult.body.factorId === "string"
          ? bodyResult.body.factorId
          : "";
      const code =
        typeof bodyResult.body.code === "string"
          ? bodyResult.body.code.trim()
          : "";

      if (!factorId || !/^\d{6}$/.test(code)) {
        return jsonResponse(
          { ok: false, message: "Enter the 6-digit code from your authenticator app." },
          400,
        );
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) {
        return jsonResponse(
          {
            ok: false,
            message:
              challenge.error?.message ??
              "The authenticator challenge could not be created.",
          },
          400,
        );
      }

      const verified = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });

      if (verified.error) {
        return jsonResponse(
          {
            ok: false,
            message:
              verified.error.message ??
              "That authenticator code is invalid. Try again.",
          },
          400,
        );
      }

      return jsonResponse(
        { ok: true, message: "Two-factor authentication is enabled." },
        200,
      );
    }

    if (action === "unenroll") {
      const factorId =
        typeof bodyResult.body.factorId === "string"
          ? bodyResult.body.factorId
          : "";

      if (!factorId) {
        return jsonResponse(
          { ok: false, message: "The authenticator factor is missing." },
          400,
        );
      }

      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        return jsonResponse(
          {
            ok: false,
            message: error.message ?? "Two-factor authentication could not be turned off.",
          },
          400,
        );
      }

      return jsonResponse(
        { ok: true, message: "Two-factor authentication is off." },
        200,
      );
    }

    return jsonResponse(
      { ok: false, message: "The 2FA action is not supported." },
      400,
    );
  } catch (error) {
    return handleApiError(
      "account-mfa",
      error,
      "Two-factor authentication could not be updated.",
    );
  }
}
