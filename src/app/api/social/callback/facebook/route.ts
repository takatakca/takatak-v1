import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { processFacebookOAuthCallback } from "@/lib/social/connections/facebook-oauth-callback";
import {
  FACEBOOK_OAUTH_HANDOFF_COOKIE,
  FACEBOOK_OAUTH_HANDOFF_PATH,
  facebookOAuthHandoffCookieOptions,
  sealFacebookOAuthHandoff,
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

function readCallbackFieldsFromSearch(
  request: NextRequest,
): Record<string, string | undefined> {
  const params = request.nextUrl.searchParams;

  return {
    code: params.get("code") ?? undefined,
    state: params.get("state") ?? undefined,
    error: params.get("error") ?? undefined,
    error_reason: params.get("error_reason") ?? undefined,
    error_description:
      params.get("error_description") ?? undefined,
  };
}

async function readCallbackFieldsFromBody(
  request: NextRequest,
): Promise<Record<string, string | undefined>> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<
      string,
      unknown
    >;

    return {
      code:
        typeof body.code === "string" ? body.code : undefined,
      state:
        typeof body.state === "string"
          ? body.state
          : undefined,
      error:
        typeof body.error === "string"
          ? body.error
          : undefined,
      error_reason:
        typeof body.error_reason === "string"
          ? body.error_reason
          : undefined,
      error_description:
        typeof body.error_description === "string"
          ? body.error_description
          : undefined,
    };
  }

  if (
    contentType.includes(
      "application/x-www-form-urlencoded",
    )
  ) {
    const form = await request.formData();

    const read = (key: string) => {
      const value = form.get(key);
      return typeof value === "string" ? value : undefined;
    };

    return {
      code: read("code"),
      state: read("state"),
      error: read("error"),
      error_reason: read("error_reason"),
      error_description: read("error_description"),
    };
  }

  return {};
}

async function resolveProfileId(): Promise<string | null> {
  const { access } = await getServerAccessContext();

  if (
    access.mode === "client_scoped" ||
    access.mode === "platform_admin" ||
    access.mode === "selection_required"
  ) {
    return access.profileId;
  }

  return null;
}

async function finishCallback(
  rawQuery: Record<string, string | undefined>,
): Promise<NextResponse> {
  const profileId = await resolveProfileId();

  if (!profileId) {
    const { access } = await getServerAccessContext();

    if (
      access.mode === "denied" &&
      access.reason === "not_authenticated"
    ) {
      logSocialOAuthEvent("facebook-oauth-callback", {
        stage: "session",
        outcome: "login_required",
        provider: "meta",
      });

      const login = new URL("/login", applicationOrigin());
      login.searchParams.set(
        "next",
        "/dashboard/social?connections=open",
      );
      login.searchParams.set(
        "error",
        "social_oauth_login_required",
      );
      return NextResponse.redirect(login);
    }
  }

  const result = await processFacebookOAuthCallback({
    rawQuery,
    profileId,
  });

  return redirectTo(result.returnPath);
}

/**
 * Meta browser redirect (GET + query) or edge relay (POST + body).
 *
 * GET never processes in-place: it seals params into an httpOnly cookie
 * and 303-redirects to /handoff with an empty query string so subsequent
 * application/access log lines do not carry OAuth secrets.
 *
 * POST is for a production relay that receives Meta's redirect and
 * forwards fields in the body (no query string on the Next.js origin).
 */
export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  logSocialOAuthEvent("facebook-oauth-callback", {
    stage: "ingress",
    outcome: "handoff_redirect",
    provider: "meta",
  });

  const fields = readCallbackFieldsFromSearch(request);
  const origin = applicationOrigin();
  const handoffUrl = new URL(
    FACEBOOK_OAUTH_HANDOFF_PATH,
    origin,
  );

  try {
    const sealed = sealFacebookOAuthHandoff(fields);
    const response = NextResponse.redirect(handoffUrl, 303);

    response.cookies.set(
      FACEBOOK_OAUTH_HANDOFF_COOKIE,
      sealed,
      facebookOAuthHandoffCookieOptions(origin),
    );

    return response;
  } catch {
    logSocialOAuthEvent("facebook-oauth-callback", {
      stage: "ingress",
      outcome: "handoff_seal_failed",
      provider: "meta",
    });

    return redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
  }
}

/**
 * Body-only completion used by the production OAuth relay.
 * Never accepts secrets from the query string on this method.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  logSocialOAuthEvent("facebook-oauth-callback", {
    stage: "relay_post",
    outcome: "accepted",
    provider: "meta",
  });

  // Ignore any accidental query string on POST — body is the only input.
  const fields = await readCallbackFieldsFromBody(request);

  return finishCallback(fields);
}
