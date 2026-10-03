import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { createAhmvExperienceLaunch } from "@/lib/billing/hockey/experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=%2Fapi%2Fexperiences%2Fahmv%2Flaunch", process.env.NEXT_PUBLIC_APP_URL),
    );
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return jsonResponse({ ok: false, message: "AHMV access is not available." }, 403);
  }
  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse({ ok: false, message: "AHMV access is temporarily unavailable." }, 503);
  }

  try {
    const launch = await createAhmvExperienceLaunch(user.id);
    return NextResponse.redirect(launch.url, {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleApiError(
      "ahmv-experience-launch",
      error,
      "AHMV experience could not be opened.",
    );
  }
}
