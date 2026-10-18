import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { authErrorResponse, authJson, readTrustedJsonBody, wrapAuthRoute } from "@/lib/auth/auth-json";
import { getSupabaseEnv } from "@/lib/auth/env";
import { normalizePhone } from "@/lib/auth/otp/phone";
import { phoneAuthMessage } from "@/lib/auth/phone-auth-message";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin SMS login request.
 *
 * Avoid a browser -> Supabase cross-origin OTP request (which can be blocked
 * before it reaches Supabase). NEVER automatically retry this request: if the
 * response is lost, the first attempt may already have sent a paid SMS.
 */
async function requestSmsLogin(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, 1000);
  if (!parsed.ok) return parsed.response;

  const phone = typeof (parsed.body as { phone?: unknown } | null)?.phone === "string"
    ? (parsed.body as { phone: string }).phone
    : "";
  const normalized = normalizePhone(phone, "INTL");
  if (!normalized || phone.trim() !== normalized) {
    return authErrorResponse("Use your mobile number with the +country calling code.", 400, {
      code: "invalid_request",
    });
  }

  const env = getSupabaseEnv();
  if (!env) {
    return authErrorResponse("TAKATAK authentication is not configured.", 503, {
      code: "configuration_unavailable",
    });
  }

  // Stateless Auth client: no end-user cookies or service-role key.
  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: false },
    });
    if (error) {
      const status = error.status === 429 ? 429 : error.status === 400 ? 400 : 502;
      return authErrorResponse(phoneAuthMessage(error.message, error.code), status, {
        code: status === 429 ? "too_many_attempts" : "verification_unavailable",
      });
    }
    return authJson({ ok: true, message: "If this mobile is eligible, a login code was requested." }, 200);
  } catch {
    return authErrorResponse(
      "SMS login could not reach the authentication provider. Do not repeatedly request a code.",
      503,
      { code: "verification_unavailable" },
    );
  }
}

export const POST = wrapAuthRoute(
  "sms-login",
  "TAKATAK SMS login is temporarily unavailable.",
  requestSmsLogin,
);
