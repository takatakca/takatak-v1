// Claude (Anthropic) · 2026-11-21 — native app: exchange the refresh token for a new session.
// Supabase rotates the refresh token on every use; the phone stores the new pair.
import type { NextRequest } from "next/server";

import { authErrorResponse, authJson, readTrustedJsonBody, wrapAuthRoute } from "@/lib/auth/auth-json";
import { statelessAuthClient } from "@/lib/mobile/mobile-auth";
import { normalizeRefreshToken, toMobileSession } from "@/lib/mobile/mobile-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function refresh(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, 2000);
  if (!parsed.ok) return parsed.response;
  const refreshToken = normalizeRefreshToken((parsed.body as { refreshToken?: unknown } | null)?.refreshToken);
  if (!refreshToken) return authErrorResponse("Please sign in again.", 401, { code: "session_expired" });

  const supabase = statelessAuthClient();
  if (!supabase) {
    return authErrorResponse("TAKATAK authentication is not configured.", 503, { code: "configuration_unavailable" });
  }

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  const session = toMobileSession(data?.session);
  if (error || !session) {
    const network = !error?.status || error.status >= 500;
    return network
      ? authErrorResponse("The sign-in service could not be reached. Please try again.", 503, { code: "auth_unavailable" })
      : authErrorResponse("Your session has expired. Please sign in again.", 401, { code: "session_expired" });
  }
  return authJson({ ok: true, message: "Session refreshed.", session }, 200);
}

export const POST = wrapAuthRoute("mobile-refresh", "Sign-in is temporarily unavailable.", refresh);
