import { NextRequest } from "next/server";

import {
  authErrorResponse,
  authJson,
  readTrustedJsonBody,
  wrapAuthRoute,
} from "@/lib/auth/auth-json";
import { verifyEmailOtp, verifyPhoneOtp } from "@/lib/auth/otp/service";
import { applySessionCookies } from "@/lib/auth/workspace-session-cookies";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BYTES = 4_000;

async function handleVerifyOtp(request: NextRequest) {
  const parsed = await readTrustedJsonBody(request, MAXIMUM_REQUEST_BYTES);
  if (!parsed.ok) {
    return parsed.response;
  }

  const body = parsed.body;
  if (!body || typeof body !== "object") {
    return authErrorResponse("Phone or email is required", 400, {
      code: "invalid_request",
    });
  }

  const input = body as {
    email?: unknown;
    phone?: unknown;
    otp?: unknown;
    next?: unknown;
  };
  const otp = typeof input.otp === "string" ? input.otp.trim() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const next =
    typeof input.next === "string"
      ? sanitizeNextPath(input.next)
      : "/dashboard";
  const existingCookies = request.cookies.getAll();

  if (phone) {
    const result = await verifyPhoneOtp(phone, otp, { existingCookies });
    const response = authJson(
      {
        ok: result.ok,
        message: result.message,
        ...(result.code ? { code: result.code } : {}),
        redirectTo: result.ok ? next : undefined,
      },
      result.status,
    );
    if (result.ok && result.cookies) {
      const cookies = applySessionCookies(response, result.cookies);
      if (!cookies.ok) {
        return authErrorResponse(cookies.message, 500, {
          code: "session_unavailable",
        });
      }
    }
    return response;
  }

  if (email) {
    const result = await verifyEmailOtp(email, otp, { existingCookies });
    const response = authJson(
      {
        ok: result.ok,
        message: result.message,
        ...(result.code ? { code: result.code } : {}),
        redirectTo: result.ok ? next : undefined,
      },
      result.status,
    );
    if (result.ok && result.cookies) {
      const cookies = applySessionCookies(response, result.cookies);
      if (!cookies.ok) {
        return authErrorResponse(cookies.message, 500, {
          code: "session_unavailable",
        });
      }
    }
    return response;
  }

  return authErrorResponse("Phone or email is required", 400, {
    code: "invalid_request",
  });
}

export const POST = wrapAuthRoute(
  "verify-otp",
  "The verification service is temporarily unavailable.",
  handleVerifyOtp,
);
