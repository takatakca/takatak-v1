import { NextRequest, NextResponse } from "next/server";
import {
  normalizeEmail,
  validateEmail,
} from "@/lib/auth/registration-validation";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BYTES = 2_000;

type ResendVerificationRequest = {
  email: string;
};

function createResponseHeaders(): Headers {
  const headers = new Headers();

  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");

  return headers;
}

function successResponse() {
  return NextResponse.json(
    {
      ok: true,
      message:
        "If an unverified account exists for this email, a verification email has been sent.",
    },
    {
      status: 200,
      headers: createResponseHeaders(),
    },
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: createResponseHeaders(),
    },
  );
}

function normalizeOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isTrustedRequestOrigin(request: NextRequest): boolean {
  const requestOrigin = normalizeOrigin(
    request.headers.get("origin"),
  );

  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = new Set<string>();

  allowedOrigins.add(new URL(request.url).origin);

  const configuredApplicationUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredApplicationUrl) {
    const configuredOrigin = normalizeOrigin(
      configuredApplicationUrl,
    );

    if (configuredOrigin) {
      allowedOrigins.add(configuredOrigin);
    }
  }

  return allowedOrigins.has(requestOrigin);
}

function getApplicationOrigin(request: NextRequest): string {
  const configuredApplicationUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredApplicationUrl) {
    const configuredOrigin = normalizeOrigin(
      configuredApplicationUrl,
    );

    if (configuredOrigin) {
      return configuredOrigin;
    }
  }

  return new URL(request.url).origin;
}

function isResendVerificationRequest(
  value: unknown,
): value is ResendVerificationRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const requestBody = value as Record<string, unknown>;

  return typeof requestBody.email === "string";
}

async function readRequestBody(
  request: NextRequest,
): Promise<unknown> {
  const bodyText = await request.text();
  const bodyBytes = new TextEncoder().encode(bodyText).byteLength;

  if (bodyBytes > MAXIMUM_REQUEST_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  return JSON.parse(bodyText) as unknown;
}

export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request)) {
    return errorResponse(
      "The request origin could not be verified.",
      403,
    );
  }

  const contentType =
    request.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.startsWith("application/json")) {
    return errorResponse("Invalid request format.", 415);
  }

  const contentLength = Number(
    request.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAXIMUM_REQUEST_BYTES
  ) {
    return errorResponse("The request is too large.", 413);
  }

  let requestBody: unknown;

  try {
    requestBody = await readRequestBody(request);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "REQUEST_TOO_LARGE"
    ) {
      return errorResponse("The request is too large.", 413);
    }

    return errorResponse("Invalid request body.", 400);
  }

  if (!isResendVerificationRequest(requestBody)) {
    return errorResponse(
      "Enter the email address used during registration.",
      400,
    );
  }

  const email = normalizeEmail(requestBody.email);
  const emailError = validateEmail(email);

  if (emailError) {
    return errorResponse(emailError, 400);
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return errorResponse(
      "The authentication service is not configured.",
      503,
    );
  }

  const applicationOrigin = getApplicationOrigin(request);

  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${applicationOrigin}/auth/callback`,
      },
    });

    if (!error) {
      return successResponse();
    }

    const errorCode = error.code?.toLowerCase() ?? "";
    const errorMessage = error.message.toLowerCase();

    if (
      error.status === 429 ||
      errorCode.includes("rate_limit") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("too many requests")
    ) {
      return errorResponse(
        "Please wait before requesting another verification email.",
        429,
      );
    }

    if (
      typeof error.status === "number" &&
      error.status >= 500
    ) {
      console.error(
        "[resend-verification] Supabase service failure:",
        error.code ?? error.message,
      );

      return errorResponse(
        "The verification service is temporarily unavailable.",
        503,
      );
    }

    console.info(
      "[resend-verification] Generic response returned:",
      error.code ?? "account-state-hidden",
    );

    return successResponse();
  } catch (error) {
    console.error(
      "[resend-verification] Unexpected failure:",
      error instanceof Error
        ? error.message
        : "Unknown verification error",
    );

    return errorResponse(
      "A network or authentication service error occurred. Please try again.",
      503,
    );
  }
}