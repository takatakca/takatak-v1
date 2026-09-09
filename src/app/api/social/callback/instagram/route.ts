import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { processDirectAccountOAuthCallback } from "@/lib/social/connections/direct-account-oauth-callback";
import {
  directOAuthHandoffCookieOptions,
  sealDirectOAuthHandoff,
} from "@/lib/social/connections/direct-oauth-handoff";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { INSTAGRAM_OAUTH_CALLBACK_PATH } from "@/lib/social/providers/instagram-oauth";
import { exchangeInstagramCodeForStoredCredential } from "@/lib/social/providers/instagram-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDOFF_COOKIE = "takatak_ig_oauth_handoff";
const HANDOFF_PATH = "/api/social/callback/instagram/handoff";

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

function readCallbackFieldsFromSearch(
  request: NextRequest,
): Record<string, string | undefined> {
  const params = request.nextUrl.searchParams;
  return {
    code: params.get("code") ?? undefined,
    state: params.get("state") ?? undefined,
    error: params.get("error") ?? undefined,
    error_reason: params.get("error_reason") ?? undefined,
    error_description: params.get("error_description") ?? undefined,
  };
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
    if (access.mode === "denied" && access.reason === "not_authenticated") {
      const login = new URL("/login", applicationOrigin());
      login.searchParams.set("next", "/dashboard/social?connections=open");
      login.searchParams.set("error", "social_oauth_login_required");
      return NextResponse.redirect(login);
    }
  }

  const result = await processDirectAccountOAuthCallback({
    provider: "instagram",
    rawQuery,
    profileId,
    exchangeCode: ({ code }) => exchangeInstagramCodeForStoredCredential({ code }),
  });

  return redirectTo(result.returnPath);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  logSocialOAuthEvent("instagram-oauth-callback", {
    stage: "ingress",
    outcome: "handoff_redirect",
    provider: "instagram",
  });

  const fields = readCallbackFieldsFromSearch(request);
  const origin = applicationOrigin();
  const handoffUrl = new URL(HANDOFF_PATH, origin);

  try {
    const sealed = sealDirectOAuthHandoff(fields);
    const response = NextResponse.redirect(handoffUrl, 303);
    response.cookies.set(
      HANDOFF_COOKIE,
      sealed,
      directOAuthHandoffCookieOptions({
        origin,
        callbackPath: INSTAGRAM_OAUTH_CALLBACK_PATH,
      }),
    );
    return response;
  } catch {
    return redirectTo(
      "/dashboard/social?connections=open&social_oauth=failed",
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get("content-type") ?? "";
  let fields: Record<string, string | undefined> = {};

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Record<string, unknown>;
    fields = {
      code: typeof body.code === "string" ? body.code : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      error: typeof body.error === "string" ? body.error : undefined,
      error_reason:
        typeof body.error_reason === "string" ? body.error_reason : undefined,
      error_description:
        typeof body.error_description === "string"
          ? body.error_description
          : undefined,
    };
  }

  return finishCallback(fields);
}
