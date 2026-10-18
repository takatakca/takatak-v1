import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { authErrorResponse, authJson, readTrustedJsonBody, wrapAuthRoute } from "@/lib/auth/auth-json";
import { getSupabaseEnv } from "@/lib/auth/env";
import { normalizePhone } from "@/lib/auth/otp/phone";
import { phoneAuthMessage } from "@/lib/auth/phone-auth-message";
import { normalizePersonName, validateFirstName, validateLastName } from "@/lib/auth/registration-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Request one registration OTP through the TAKATAK origin, never automatically retry. */
async function requestRegistrationOtp(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, 2000);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as { phone?: unknown; firstName?: unknown; lastName?: unknown; acceptedTerms?: unknown } | null;
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const firstName = typeof body?.firstName === "string" ? normalizePersonName(body.firstName) : "";
  const lastName = typeof body?.lastName === "string" ? normalizePersonName(body.lastName) : "";
  const normalizedPhone = normalizePhone(phone, "INTL");
  if (!normalizedPhone || normalizedPhone !== phone.trim()) {
    return authErrorResponse("Enter a valid mobile number including the country code.", 400, { code: "invalid_request" });
  }
  const nameError = validateFirstName(firstName) || validateLastName(lastName);
  if (nameError || body?.acceptedTerms !== true) {
    return authErrorResponse(nameError || "You must agree to the Terms and Privacy Policy.", 400, { code: "invalid_request" });
  }
  const env = getSupabaseEnv();
  if (!env) return authErrorResponse("TAKATAK authentication is not configured.", 503, { code: "configuration_unavailable" });
  const supabase = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const capturedAt = new Date().toISOString();
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: true,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          display_name: `${firstName} ${lastName}`.trim(),
          phone: normalizedPhone,
          source_application: "TAKATAK",
          takatak_terms_accepted_at: capturedAt,
          takatak_privacy_accepted_at: capturedAt,
          takatak_consent_captured_at: capturedAt,
        },
      },
    });
    if (error) {
      const status = error.status === 429 ? 429 : error.status === 400 ? 400 : 502;
      return authErrorResponse(phoneAuthMessage(error.message, error.code), status, {
        code: status === 429 ? "too_many_attempts" : "verification_unavailable",
      });
    }
    return authJson({ ok: true, message: "A verification code was requested." }, 200);
  } catch {
    return authErrorResponse("The verification request could not be completed. A code may already have been sent; do not repeatedly retry.", 503, {
      code: "verification_unavailable",
    });
  }
}

export const POST = wrapAuthRoute("sms-register", "TAKATAK registration verification is temporarily unavailable.", requestRegistrationOtp);
