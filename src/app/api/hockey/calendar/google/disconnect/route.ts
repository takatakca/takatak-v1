import { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { disconnectHockeyGoogleCalendar } from "@/lib/hockey/calendar/google-oauth-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return jsonResponse({ ok: false, message: "Sign in to continue." }, 401);
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });
  if (sync.outcome === "denied") {
    return jsonResponse(
      { ok: false, message: "Your TAKATAK identity could not be verified." },
      403,
    );
  }
  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse(
      { ok: false, message: "TAKATAK identity is temporarily unavailable." },
      503,
    );
  }

  try {
    const result = await disconnectHockeyGoogleCalendar(user.id);
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-google-calendar-disconnect",
      error,
      "Google Calendar could not be disconnected.",
    );
  }
}
