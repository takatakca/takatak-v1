import { NextRequest, NextResponse } from "next/server";

import { verifyEmailOtp, verifyPhoneOtp } from "@/lib/auth/otp/service";
import { applySessionCookies } from "@/lib/auth/workspace-session-cookies";
import { sanitizeNextPath } from "@/lib/security/safe-redirect";
import {
  isTrustedRequestOrigin,
  jsonAuthHeaders,
  readJsonBody,
} from "@/lib/auth/trusted-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BYTES = 4_000;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, message },
    { status, headers: jsonAuthHeaders() },
  );
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return errorResponse("The request origin could not be verified.", 403);
  }

  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return errorResponse("Invalid request format.", 415);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MAXIMUM_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return errorResponse("The request is too large.", 413);
    }
    return errorResponse("Invalid request body.", 400);
  }

  if (!body || typeof body !== "object") {
    return errorResponse("Phone or email is required", 400);
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

  if (phone) {
    const result = await verifyPhoneOtp(phone, otp);
    const response = NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        redirectTo: result.ok ? next : undefined,
      },
      { status: result.status, headers: jsonAuthHeaders() },
    );
    if (result.ok && result.cookies) {
      applySessionCookies(response, result.cookies);
    }
    return response;
  }

  if (email) {
    const result = await verifyEmailOtp(email, otp);
    const response = NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        redirectTo: result.ok ? next : undefined,
      },
      { status: result.status, headers: jsonAuthHeaders() },
    );
    if (result.ok && result.cookies) {
      applySessionCookies(response, result.cookies);
    }
    return response;
  }

  return errorResponse("Phone or email is required", 400);
}
