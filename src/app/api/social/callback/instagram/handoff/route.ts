import { NextRequest, NextResponse } from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { processDirectAccountOAuthCallback } from "@/lib/social/connections/direct-account-oauth-callback";
import {
  directOAuthHandoffCookieOptions,
  handoffPayloadToRawQuery,
  unsealDirectOAuthHandoff,
} from "@/lib/social/connections/direct-oauth-handoff";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { INSTAGRAM_OAUTH_CALLBACK_PATH } from "@/lib/social/providers/instagram-oauth";
import { exchangeInstagramCodeForStoredCredential } from "@/lib/social/providers/instagram-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDOFF_COOKIE = "takatak_ig_oauth_handoff";

function applicationOrigin(): string {
  return getApplicationOrigin();
}

function redirectTo(pathWithQuery: string): NextResponse {
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

function clearHandoffCookie(response: NextResponse, origin: string): void {
  response.cookies.set(HANDOFF_COOKIE, "", {
    ...directOAuthHandoffCookieOptions({
      origin,
      callbackPath: INSTAGRAM_OAUTH_CALLBACK_PATH,
    }),
    maxAge: 0,
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = applicationOrigin();
  const packedCookie = request.cookies.get(HANDOFF_COOKIE)?.value;

  console.log("[instagram-oauth-handoff] ENTER", {
    url: request.url,
    origin,
    hasCookie: Boolean(packedCookie),
    cookieNames: request.cookies.getAll().map((cookie) => cookie.name),
    hasQueryString: Boolean(request.nextUrl.searchParams.toString()),
  });

  if (request.nextUrl.searchParams.toString()) {
    logSocialOAuthEvent("instagram-oauth-handoff", {
      stage: "handoff",
      outcome: "rejected_query_string",
      provider: "instagram",
    });
    const response = redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }

  const packed = packedCookie;
  if (!packed) {
    const response = redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
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

    const handoffQuery = handoffPayloadToRawQuery(payload);

    console.log("[instagram-oauth-handoff] PAYLOAD", {
      hasCode: Boolean(handoffQuery.code),
      hasState: Boolean(handoffQuery.state),
      hasError: Boolean(handoffQuery.error),
      profileId,
    });

    const result = await processDirectAccountOAuthCallback({
      provider: "instagram",
      rawQuery: handoffQuery,
      profileId,
      exchangeCode: async ({ code, codeVerifier }) => {
        console.log("[instagram-oauth-handoff] TOKEN_EXCHANGE_START", {
          hasCode: Boolean(code),
          hasCodeVerifier: Boolean(codeVerifier),
        });

        try {
          const token = await exchangeInstagramCodeForStoredCredential({
            code,
          });

          console.log("[instagram-oauth-handoff] TOKEN_EXCHANGE_OK", {
            externalSubjectId: token.externalSubjectId,
            displayName: token.displayName,
            hasAccessToken: Boolean(token.accessToken),
            scopes: token.scopes,
          });

          return token;
        } catch (error) {
          console.error("[instagram-oauth-handoff] TOKEN_EXCHANGE_FAILED", {
            message:
              error instanceof Error
                ? error.message
                : String(error),
            stack:
              error instanceof Error
                ? error.stack
                : undefined,
          });
          throw error;
        }
      },
    });

    console.log("[instagram-oauth-handoff] RESULT", {
      outcome: result.outcome,
      returnPath: result.returnPath,
      message: result.message,
    });

    const response = redirectTo(result.returnPath);
    clearHandoffCookie(response, origin);
    return response;
  } catch (error) {
    console.error("[instagram-oauth-handoff] FAILED", error);

    logSocialOAuthEvent("instagram-oauth-handoff", {
      stage: "processing",
      outcome: "failed",
      provider: "instagram",
    });

    const response = redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
    clearHandoffCookie(response, origin);
    return response;
  }
}
