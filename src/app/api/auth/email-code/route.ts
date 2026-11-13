// Claude (Anthropic) · 2026-11-12 — email-code sign-in and sign-up through the
// TAKATAK identity (Supabase Auth). Owner order 2026-11-12: email and Google
// only; phone sign-in is off for now. The code is emailed by Supabase and
// verified in the browser (supabase.auth.verifyOtp), exactly like the phone
// path used to be, then /api/auth/sync-profile creates or loads the profile.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { authErrorResponse, authJson, readTrustedJsonBody, wrapAuthRoute } from "@/lib/auth/auth-json";
import { getSupabaseEnv } from "@/lib/auth/env";
import { normalizeEmail, validateEmail } from "@/lib/auth/registration-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One request, never retried automatically: a lost answer may still have sent the email. */
async function requestEmailCode(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, 1000);
  if (!parsed.ok) return parsed.response;

  const raw = (parsed.body as { email?: unknown } | null)?.email;
  const email = typeof raw === "string" ? normalizeEmail(raw) : "";
  const emailError = validateEmail(email);
  if (emailError) {
    return authErrorResponse(emailError, 400, { code: "invalid_request" });
  }

  const env = getSupabaseEnv();
  if (!env) {
    return authErrorResponse("TAKATAK authentication is not configured.", 503, {
      code: "configuration_unavailable",
    });
  }

  // Stateless Auth client: no end-user cookies and no service-role key.
  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      const limited = error.status === 429 || /rate|too many|security purposes/i.test(error.message);
      return authErrorResponse(
        limited
          ? "Too many code requests. Please wait a minute and try again."
          : "The code could not be sent. Please try again.",
        limited ? 429 : 502,
        { code: limited ? "too_many_attempts" : "verification_unavailable" },
      );
    }
    // The same answer whether or not the address is already known.
    return authJson({ ok: true, message: "We sent a sign-in code to your email." }, 200);
  } catch {
    return authErrorResponse(
      "The sign-in service could not be reached. Please try again in a moment.",
      503,
      { code: "verification_unavailable" },
    );
  }
}

export const POST = wrapAuthRoute(
  "email-code",
  "Email sign-in is temporarily unavailable.",
  requestEmailCode,
);
