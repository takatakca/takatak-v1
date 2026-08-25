import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { processFacebookOAuthCallback } from "@/lib/social/connections/facebook-oauth-callback";
import {
  FACEBOOK_OAUTH_CALLBACK_PATH,
  FACEBOOK_OAUTH_HANDOFF_COOKIE,
  facebookOAuthHandoffCookieOptions,
  handoffPayloadToRawQuery,
  unsealFacebookOAuthHandoff,
} from "@/lib/social/connections/facebook-oauth-handoff";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function applicationOrigin(): string {
  return getApplicationOrigin();
}

function redirectTo(
  pathWithQuery: string,
): NextResponse {
  const origin = applicationOrigin();
  const target = new URL(pathWithQuery, origin);

  if (target.origin !== new URL(origin).origin) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/social?connections=open&social_oauth=failed",
        origin,
      ),
    );
  }

  return NextResponse.redirect(target);
}

function clearHandoffCookie(
  response: NextResponse,
  origin: string,
): void {
  response.cookies.set(
    FACEBOOK_OAUTH_HANDOFF_COOKIE,
    "",
    {
      ...facebookOAuthHandoffCookieOptions(origin),
      maxAge: 0,
    },
  );
}

/**
 * Query-free completion hop. OAuth secrets arrive only via httpOnly cookie
 * sealed by the ingress GET (or are absent). This pathname is safe to appear
 * in access logs.
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const origin = applicationOrigin();

  // Refuse to process secrets from the query string on the handoff path.
  if (request.nextUrl.searchParams.toString()) {
    logSocialOAuthEvent("facebook-oauth-handoff", {
      stage: "handoff",
      outcome: "rejected_query_string",
      provider: "meta",
    });

    const response = redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }

  logSocialOAuthEvent("facebook-oauth-handoff", {
    stage: "handoff",
    outcome: "accepted",
    provider: "meta",
  });

  const packed = request.cookies.get(
    FACEBOOK_OAUTH_HANDOFF_COOKIE,
  )?.value;

  if (!packed) {
    const response = redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }

  let rawQuery: Record<string, string | undefined>;

  try {
    rawQuery = handoffPayloadToRawQuery(
      unsealFacebookOAuthHandoff(packed),
    );
  } catch {
    logSocialOAuthEvent("facebook-oauth-handoff", {
      stage: "handoff",
      outcome: "unseal_failed",
      provider: "meta",
    });

    const response = redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }

  const { access } = await getServerAccessContext();

  let profileId: string | null = null;

  if (
    access.mode === "client_scoped" ||
    access.mode === "platform_admin" ||
    access.mode === "selection_required"
  ) {
    profileId = access.profileId;
  }

  if (
    access.mode === "denied" &&
    access.reason === "not_authenticated"
  ) {
    const login = new URL("/login", origin);
    login.searchParams.set(
      "next",
      "/dashboard/social?connections=open",
    );
    login.searchParams.set(
      "error",
      "social_oauth_login_required",
    );
    const response = NextResponse.redirect(login);
    clearHandoffCookie(response, origin);
    return response;
  }

  const result = await processFacebookOAuthCallback({
    rawQuery,
    profileId,
  });

  const response = redirectTo(result.returnPath);
  clearHandoffCookie(response, origin);

  // Ensure cookie path matches seal path for deletion.
  void FACEBOOK_OAUTH_CALLBACK_PATH;

  return response;
}
