import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getHockeyGoogleCalendarStatus } from "@/lib/hockey/calendar/google-oauth-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
    const calendar = await getHockeyGoogleCalendarStatus(user.id);
    return jsonResponse({ ok: true, calendar }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-google-calendar-status",
      error,
      "Google Calendar status could not be loaded.",
    );
  }
}
