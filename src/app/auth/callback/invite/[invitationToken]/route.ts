import { NextRequest, NextResponse } from "next/server";
import { isValidInvitationToken } from "@/lib/team/invitation-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithoutCache(url: string): NextResponse {
  const response = NextResponse.redirect(url);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      invitationToken: string;
    }>;
  },
): Promise<NextResponse> {
  const { invitationToken } = await context.params;

  const tokenHash =
    request.nextUrl.searchParams.get("token_hash");

  const otpType =
    request.nextUrl.searchParams.get("type");

    if (
        !isValidInvitationToken(invitationToken) ||
        !tokenHash ||
        (otpType !== "invite" &&
          otpType !== "magiclink")
    ) {
    return redirectWithoutCache(
      new URL(
        "/login?error=invalid_invitation_link",
        request.url,
      ).toString(),
    );
  }

  const callbackUrl = new URL(
    "/auth/callback",
    request.url,
  );

  callbackUrl.searchParams.set(
    "invitation_token",
    invitationToken,
  );

  callbackUrl.searchParams.set(
    "token_hash",
    tokenHash,
  );

  callbackUrl.searchParams.set(
    "type",
    otpType,
  );

  return redirectWithoutCache(callbackUrl.toString());
}