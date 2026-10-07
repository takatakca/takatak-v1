import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import { processBlueskyOAuthCallback } from "@/lib/social/connections/bluesky-oauth-callback";
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
  const target =
    new URL(pathWithQuery, origin);

  if (
    target.origin !==
    new URL(origin).origin
  ) {
    return NextResponse.redirect(
      new URL(
        "/dashboard/social?connections=open&social_oauth=failed",
        origin,
      ),
    );
  }

  return NextResponse.redirect(
    target,
  );
}

function readCallbackFields(
  request: NextRequest,
): Record<string, string | undefined> {
  const params =
    request.nextUrl.searchParams;

  return {
    code:
      params.get("code") ??
      undefined,
    state:
      params.get("state") ??
      undefined,
    iss:
      params.get("iss") ??
      undefined,
    error:
      params.get("error") ??
      undefined,
    error_description:
      params.get(
        "error_description",
      ) ?? undefined,
  };
}

async function resolveProfileId():
  Promise<string | null> {
  const { access } =
    await getServerAccessContext();

  return access.mode ===
      "client_scoped" ||
    access.mode ===
      "platform_admin" ||
    access.mode ===
      "selection_required"
    ? access.profileId
    : null;
}

async function finishCallback(
  rawQuery: Record<
    string,
    string | undefined
  >,
): Promise<NextResponse> {
  const profileId =
    await resolveProfileId();

  const callback =
    await processBlueskyOAuthCallback({
      rawQuery,
      profileId,
    });

  return redirectTo(
    callback.returnPath,
  );
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  logSocialOAuthEvent(
    "bluesky-oauth-callback",
    {
      stage: "ingress",
      outcome: "processing",
      provider: "bluesky",
    },
  );

  return finishCallback(
    readCallbackFields(request),
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  let fields: Record<
    string,
    string | undefined
  > = {};

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    const body =
      (await request.json()) as Record<
        string,
        unknown
      >;

    fields = {
      code:
        typeof body.code === "string"
          ? body.code
          : undefined,
      state:
        typeof body.state === "string"
          ? body.state
          : undefined,
      iss:
        typeof body.iss === "string"
          ? body.iss
          : undefined,
      error:
        typeof body.error === "string"
          ? body.error
          : undefined,
      error_description:
        typeof body.error_description ===
        "string"
          ? body.error_description
          : undefined,
    };
  }

  return finishCallback(fields);
}
