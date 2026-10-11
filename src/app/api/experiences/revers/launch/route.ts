import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { createReversExperienceLaunch } from "@/lib/experiences/revers-experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fapi%2Fexperiences%2Frevers%2Flaunch", request.url),
    );
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return jsonResponse(
      { ok: false, message: "REVERS access is not available." },
      403,
    );
  }

  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse(
      { ok: false, message: "REVERS access is temporarily unavailable." },
      503,
    );
  }

  try {
    const launch = await createReversExperienceLaunch(user.id);
    const response = NextResponse.redirect(launch.url, 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError(
      "revers-experience-launch",
      error,
      "REVERS experience could not be opened.",
    );
  }
}
