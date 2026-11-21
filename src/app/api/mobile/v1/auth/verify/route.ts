// Claude (Anthropic) · 2026-11-21 — native app sign-in, step 2. Step 1 is the website's own
// POST /api/auth/email-code (same email, same Supabase code). Here the code is checked on the server,
// the TAKATAK profile is created or loaded exactly as /api/auth/sync-profile does, and the phone gets
// its tokens in the answer body (it has no cookie jar). Origin must be the TAKATAK site, like every
// credential-changing auth call.
import type { NextRequest } from "next/server";

import { authErrorResponse, authJson, readTrustedJsonBody, wrapAuthRoute } from "@/lib/auth/auth-json";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { normalizeEmail, validateEmail } from "@/lib/auth/registration-validation";
import { statelessAuthClient } from "@/lib/mobile/mobile-auth";
import { normalizeEmailCode, toMobileSession } from "@/lib/mobile/mobile-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verify(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, 1000);
  if (!parsed.ok) return parsed.response;
  const body = (parsed.body ?? {}) as { email?: unknown; code?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const code = normalizeEmailCode(body.code);
  if (validateEmail(email) || !code) {
    return authErrorResponse("Enter your email and the code you received.", 400, { code: "invalid_request" });
  }

  const supabase = statelessAuthClient();
  if (!supabase) {
    return authErrorResponse("TAKATAK authentication is not configured.", 503, { code: "configuration_unavailable" });
  }

  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  const session = toMobileSession(data?.session);
  if (error || !data?.user || !session) {
    const limited = error?.status === 429;
    return authErrorResponse(
      limited ? "Too many attempts. Please wait a minute and try again." : "This code is not valid or has expired.",
      limited ? 429 : 401,
      { code: limited ? "too_many_attempts" : "invalid_code" },
    );
  }

  const profile = await ensureProfileForSupabaseUser(data.user);
  if (profile.outcome === "denied") {
    return authErrorResponse("The TAKATAK identity could not be authorized.", 403, { code: "identity_mismatch" });
  }
  if (profile.outcome === "unavailable" || profile.outcome === "error") {
    return authErrorResponse("Your TAKATAK profile could not be loaded. Please try again.", 503, { code: "profile_sync_failed" });
  }

  return authJson({ ok: true, message: "Signed in.", session, user: { id: data.user.id, email: data.user.email ?? email } }, 200);
}

export const POST = wrapAuthRoute("mobile-verify", "Sign-in is temporarily unavailable.", verify);
