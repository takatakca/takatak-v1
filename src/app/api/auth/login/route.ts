import { NextRequest } from "next/server";

import {
  authErrorResponse,
  authJson,
  readTrustedJsonBody,
  wrapAuthRoute,
} from "@/lib/auth/auth-json";
import {
  sendEmailOtp,
  sendPhoneOtp,
} from "@/lib/auth/otp/service";
import { normalizeEmail, validateEmail } from "@/lib/auth/registration-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BYTES = 4_000;

async function handleLogin(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, MAXIMUM_REQUEST_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.body;
  if (!body || typeof body !== "object") {
    return authErrorResponse("Email or phone number is required", 400, {
      code: "invalid_request",
    });
  }

  const input = body as { email?: unknown; phone?: unknown };
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";

  if (phone) {
    const result = await sendPhoneOtp(phone);
    return authJson(
      {
        ok: result.ok,
        message: result.message,
        ...(result.code ? { code: result.code } : {}),
      },
      result.status,
    );
  }

  if (email) {
    const normalized = normalizeEmail(email);
    const emailError = validateEmail(normalized);
    if (emailError) {
      return authErrorResponse(emailError, 400, { code: "invalid_request" });
    }

    const result = await sendEmailOtp(normalized);
    return authJson(
      {
        ok: result.ok,
        message: result.message,
        ...(result.code ? { code: result.code } : {}),
      },
      result.status,
    );
  }

  return authErrorResponse("Email or phone number is required", 400, {
    code: "invalid_request",
  });
}

export const POST = wrapAuthRoute(
  "login",
  "The verification service is temporarily unavailable.",
  handleLogin,
);
