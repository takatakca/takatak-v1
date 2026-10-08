import { NextRequest, NextResponse } from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  directOAuthHandoffCookieOptions,
  handoffPayloadToRawQuery,
  unsealDirectOAuthHandoff,
} from "@/lib/social/connections/direct-oauth-handoff";
import { processGoogleAdsOAuthCallback } from "@/lib/social/connections/google-ads-oauth-callback";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { GOOGLE_ADS_OAUTH_CALLBACK_PATH } from "@/lib/social/providers/google-ads-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDOFF_COOKIE = "takatak_google_ads_oauth_handoff";

function applicationOrigin(): string {
  return getApplicationOrigin();
}

function redirectTo(pathWithQuery: string): NextResponse {
  const origin = applicationOrigin();
  const target = new URL(pathWithQuery, origin);
  if (target.origin !== new URL(origin).origin) {
    return NextResponse.redirect(
      new URL("/dashboard/social/google_ads?social_oauth=failed", origin),
    );
  }
  return NextResponse.redirect(target);
}

function clearHandoffCookie(response: NextResponse, origin: string): void {
  response.cookies.set(HANDOFF_COOKIE, "", {
    ...directOAuthHandoffCookieOptions({
      origin,
      callbackPath: GOOGLE_ADS_OAUTH_CALLBACK_PATH,
    }),
    maxAge: 0,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = applicationOrigin();

  if (request.nextUrl.searchParams.toString()) {
    logSocialOAuthEvent("google-ads-oauth-handoff", {
      stage: "handoff",
      outcome: "rejected_query_string",
      provider: "google_ads",
    });
    const response = redirectTo(
      "/dashboard/social/google_ads?social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }

  const packed = request.cookies.get(HANDOFF_COOKIE)?.value;
  if (!packed) {
    const response = redirectTo(
      "/dashboard/social/google_ads?social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }

  try {
    const payload = unsealDirectOAuthHandoff(packed);
    const { access } = await getServerAccessContext();
    const profileId =
      access.mode === "client_scoped" ||
      access.mode === "platform_admin" ||
      access.mode === "selection_required"
        ? access.profileId
        : null;

    const result = await processGoogleAdsOAuthCallback({
      rawQuery: handoffPayloadToRawQuery(payload),
      profileId,
    });

    const response = redirectTo(result.returnPath);
    clearHandoffCookie(response, origin);
    return response;
  } catch {
    const response = redirectTo(
      "/dashboard/social/google_ads?social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }
}
