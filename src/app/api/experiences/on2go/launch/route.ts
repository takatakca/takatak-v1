import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { createOn2goExperienceLaunch } from "@/lib/integrations/on2go/experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// « Ouvrir ON2GO » from a signed-in TAKATAK session: a one-time code sent to on2go.ca's callback. No workspace is
// created for a customer (createPersonalWorkspace: false).
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fapi%2Fexperiences%2Fon2go%2Flaunch", request.url),
    );
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return jsonResponse({ ok: false, message: "ON2GO access is not available." }, 403);
  }
  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse({ ok: false, message: "ON2GO access is temporarily unavailable." }, 503);
  }

  try {
    const launch = await createOn2goExperienceLaunch(user.id);
    const response = NextResponse.redirect(launch.url, 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError("on2go-experience-launch", error, "ON2GO could not be opened.");
  }
}
