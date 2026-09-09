import { NextRequest, NextResponse } from "next/server";

import { createAuthErrorId } from "@/lib/auth/auth-error-id";
import {
  isTrustedRequestOrigin,
  jsonAuthHeaders,
  readJsonBody,
} from "@/lib/auth/trusted-origin";
import { redactSecrets } from "@/lib/security/redact";

export type AuthJsonBody = {
  ok: boolean;
  message: string;
  errorId?: string;
  code?: string;
  redirectTo?: string;
  fieldErrors?: Record<string, string>;
  [key: string]: unknown;
};

export type AuthFailureCode =
  | "invalid_otp"
  | "expired_otp"
  | "too_many_attempts"
  | "disabled_account"
  | "otp_not_requested"
  | "email_not_found"
  | "phone_not_found"
  | "configuration_unavailable"
  | "session_unavailable"
  | "verification_unavailable"
  | "verification_in_progress"
  | "invalid_request"
  | "origin_untrusted"
  | "database_unavailable";

const SENSITIVE_LOG_KEYS = [
  "otp",
  "otphash",
  "otp_hash",
  "pending.v1",
  "password",
  "token",
  "cookie",
  "authorization",
  "secret",
  "hashed_token",
  "access_token",
  "refresh_token",
];

export function authJson(
  body: AuthJsonBody,
  status: number,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: jsonAuthHeaders(),
  });
}

export function authErrorResponse(
  message: string,
  status: number,
  options?: {
    errorId?: string;
    code?: AuthFailureCode | string;
    fieldErrors?: Record<string, string>;
  },
): NextResponse {
  return authJson(
    {
      ok: false,
      message,
      ...(options?.errorId ? { errorId: options.errorId } : {}),
      ...(options?.code ? { code: options.code } : {}),
      ...(options?.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    },
    status,
  );
}

export function logAuthFailure(
  scope: string,
  stage: string,
  errorId: string,
  error?: unknown,
): void {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unexpected_error";
  const safe = redactSecrets(raw).slice(0, 200);
  if (SENSITIVE_LOG_KEYS.some((key) => safe.toLowerCase().includes(key))) {
    console.error(`[${scope}] errorId=${errorId} stage=${stage}`);
    return;
  }
  console.error(`[${scope}] errorId=${errorId} stage=${stage} detail=${safe}`);
}

export function unexpectedAuthFailure(
  scope: string,
  message: string,
  error: unknown,
  stage = "unhandled",
): NextResponse {
  const errorId = createAuthErrorId();
  logAuthFailure(scope, stage, errorId, error);
  return authErrorResponse(message, 500, {
    errorId,
    code: "verification_unavailable",
  });
}

export async function readTrustedJsonBody(
  request: NextRequest,
  maximumBytes: number,
): Promise<
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }
> {
  if (!isTrustedRequestOrigin(request)) {
    return {
      ok: false,
      response: authErrorResponse(
        "The request origin could not be verified.",
        403,
        { code: "origin_untrusted" },
      ),
    };
  }

  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return {
      ok: false,
      response: authErrorResponse("Invalid request format.", 415, {
        code: "invalid_request",
      }),
    };
  }

  try {
    const body = await readJsonBody(request, maximumBytes);
    return { ok: true, body };
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return {
        ok: false,
        response: authErrorResponse("The request is too large.", 413, {
          code: "invalid_request",
        }),
      };
    }
    return {
      ok: false,
      response: authErrorResponse("Invalid request body.", 400, {
        code: "invalid_request",
      }),
    };
  }
}

export function wrapAuthRoute(
  scope: string,
  fallbackMessage: string,
  handler: (request: NextRequest) => Promise<NextResponse>,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    try {
      return await handler(request);
    } catch (error) {
      return unexpectedAuthFailure(scope, fallbackMessage, error);
    }
  };
}
