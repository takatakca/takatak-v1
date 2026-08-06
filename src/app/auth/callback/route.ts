import type {
  EmailOtpType,
  User,
} from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  ensureProfileForSupabaseUser,
  type ProfileSyncOutcome,
} from "@/lib/auth/profile-sync";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  ACTIVE_CLIENT_COOKIE,
} from "@/lib/security/access-context";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import { acceptWorkspaceInvitation } from "@/lib/team/accept-invitation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_EMAIL_OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function getApplicationOrigin(request: NextRequest): string {
  const configuredApplicationUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredApplicationUrl) {
    try {
      return new URL(configuredApplicationUrl).origin;
    } catch {
      return new URL(request.url).origin;
    }
  }

  return new URL(request.url).origin;
}

function isSupportedEmailOtpType(
  value: string | null,
): value is EmailOtpType {
  return (
    value !== null &&
    SUPPORTED_EMAIL_OTP_TYPES.includes(value as EmailOtpType)
  );
}

function isSuccessfulProfileSync(
  result: ProfileSyncOutcome,
): result is Extract<
  ProfileSyncOutcome,
  {
    outcome: "existing" | "created" | "updated";
  }
> {
  return (
    result.outcome === "existing" ||
    result.outcome === "created" ||
    result.outcome === "updated"
  );
}

function redirectWithoutCache(
  url: string,
  activeClientId?: string,
): NextResponse {
  const response = NextResponse.redirect(url);

  response.headers.set("Cache-Control", "no-store");

  if (activeClientId) {
    response.cookies.set(
      ACTIVE_CLIENT_COOKIE,
      activeClientId,
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      },
    );
  }

  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const applicationOrigin = getApplicationOrigin(request);

  const code = requestUrl.searchParams.get("code");
  const tokenHash =
    requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type");
  const invitationToken =
    requestUrl.searchParams.get("invitation_token");

  const nextPath = sanitizeNextPath(
    requestUrl.searchParams.get("next"),
  );

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return redirectWithoutCache(
      `${applicationOrigin}/login?error=auth_not_configured`,
    );
  }

  try {
    let verifiedUser: User | null = null;

    if (code) {
      const { data, error } =
        await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        throw error;
      }

      verifiedUser = data.user;
    } else if (
      tokenHash &&
      isSupportedEmailOtpType(otpType)
    ) {
      const { data, error } =
        await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType,
        });

      if (error) {
        throw error;
      }

      verifiedUser = data.user;
    }

    if (!verifiedUser) {
      return redirectWithoutCache(
        `${applicationOrigin}/login?error=auth_callback_failed`,
      );
    }

    const isInvitationFlow =
    Boolean(invitationToken) &&
    (otpType === "invite" ||
    otpType === "magiclink");

    if (isInvitationFlow && !invitationToken) {
      await supabase.auth.signOut();

      return redirectWithoutCache(
        `${applicationOrigin}/login?error=invitation_token_missing`,
      );
    }

    const profileResult =
      await ensureProfileForSupabaseUser(
        verifiedUser,
        {
          createPersonalWorkspace: !isInvitationFlow,
        },
      );

    if (!isSuccessfulProfileSync(profileResult)) {
      console.error(
        "[auth-callback] Profile synchronization failed:",
        profileResult.outcome,
      );

      await supabase.auth.signOut();

      return redirectWithoutCache(
        `${applicationOrigin}/login?error=profile_sync_failed`,
      );
    }

    if (isInvitationFlow && invitationToken) {
      const invitationResult =
        await acceptWorkspaceInvitation(
          verifiedUser,
          profileResult.profileId,
          invitationToken,
        );

      if (
        invitationResult.outcome !== "accepted" &&
        invitationResult.outcome !== "already_accepted"
      ) {
        console.error(
          "[auth-callback] Invitation acceptance failed:",
          invitationResult.outcome,
        );

        await supabase.auth.signOut();

        return redirectWithoutCache(
          `${applicationOrigin}/login?error=${encodeURIComponent(
            `invitation_${invitationResult.outcome}`,
          )}`,
        );
      }

      const invitationDestination =
        otpType === "invite"
          ? "/complete-invitation"
          : "/dashboard";

      return redirectWithoutCache(
        `${applicationOrigin}${invitationDestination}`,
        invitationResult.clientId,
      );
    }

    return redirectWithoutCache(
      `${applicationOrigin}${nextPath}`,
    );
  } catch (error) {
    console.error(
      "[auth-callback] Email verification failed:",
      error instanceof Error
        ? error.message
        : "Unknown verification error",
    );

    return redirectWithoutCache(
      `${applicationOrigin}/login?error=auth_callback_failed`,
    );
  }
}