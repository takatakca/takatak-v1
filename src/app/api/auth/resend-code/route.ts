import { NextRequest, NextResponse } from "next/server";

import { sendEmailOtp, sendPhoneOtp } from "@/lib/auth/otp/service";
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
    return errorResponse("Email or phone number is required", 400);
  }

  const input = body as { email?: unknown; phone?: unknown };
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";

  if (phone) {
    const result = await sendPhoneOtp(phone);
    return NextResponse.json(
      { ok: result.ok, message: result.message },
      { status: result.status, headers: jsonAuthHeaders() },
    );
  }

  if (email) {
    const result = await sendEmailOtp(email);
    return NextResponse.json(
      { ok: result.ok, message: result.message },
      { status: result.status, headers: jsonAuthHeaders() },
    );
  }

  return errorResponse("Email or phone number is required", 400);
}
