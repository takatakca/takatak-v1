import { NextRequest, NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { completeHockeyGoogleCalendarOAuth } from "@/lib/hockey/calendar/google-oauth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  const url = new URL(request.url);

  const result = await completeHockeyGoogleCalendarOAuth({
    authUserId: user?.id ?? null,
    state: url.searchParams.get("state"),
    code: url.searchParams.get("code"),
    error: url.searchParams.get("error"),
  });

  return NextResponse.redirect(new URL(result.returnPath, request.url), 303);
}
