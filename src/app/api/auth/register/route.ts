import { NextRequest, NextResponse } from "next/server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import {
  hasRegistrationErrors,
  isRegistrationInput,
  type RegistrationFieldErrors,
  validateRegistrationInput,
} from "@/lib/auth/registration-validation";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  getApplicationOrigin,
  originFromRequest,
} from "@/lib/config/app-origin";
import { getPrisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BYTES = 10_000;

type SupabaseRegistrationError = {
  message: string;
  status?: number;
  code?: string;
};

function createResponseHeaders(): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json");
  return headers;
}

function errorResponse(
  message: string,
  status: number,
  fieldErrors: RegistrationFieldErrors = {},
) {
  return NextResponse.json(
    {
      ok: false,
      message,
      fieldErrors,
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
  const requestOrigin = normalizeOrigin(request.headers.get("origin"));

  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = new Set<string>();

  allowedOrigins.add(originFromRequest(request));
  allowedOrigins.add(getApplicationOrigin(new URL(request.url).origin));

  return allowedOrigins.has(requestOrigin);
}

function getApplicationOriginFromRequest(request: NextRequest): string {
  return originFromRequest(request);
}

function getFriendlySupabaseError(
  error: SupabaseRegistrationError,
): {
  message: string;
  status: number;
  fieldErrors: RegistrationFieldErrors;
} {
  const code = error.code?.toLowerCase() ?? "";
  const message = error.message.toLowerCase();

  if (
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  ) {
    return {
      message: "An account already exists for this email address.",
      status: 409,
      fieldErrors: {
        email: "An account already exists for this email address.",
      },
    };
  }

  if (
    code === "weak_password" ||
    message.includes("weak password") ||
    message.includes("password should") ||
    message.includes("password must")
  ) {
    return {
      message: "The password does not meet the security requirements.",
      status: 400,
      fieldErrors: {
        password:
          "The password does not meet the security requirements.",
      },
    };
  }

  if (
    code === "email_address_invalid" ||
    message.includes("invalid email") ||
    message.includes("email address is invalid")
  ) {
    return {
      message: "Enter a valid email address.",
      status: 400,
      fieldErrors: {
        email: "Enter a valid email address.",
      },
    };
  }

  if (
    error.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return {
      message:
        "Too many registration attempts. Please wait before trying again.",
      status: 429,
      fieldErrors: {},
    };
  }

  if (
    code === "signup_disabled" ||
    message.includes("signup is disabled") ||
    message.includes("signups not allowed")
  ) {
    return {
      message:
        "New account registration is currently unavailable.",
      status: 503,
      fieldErrors: {},
    };
  }

  if (
    typeof error.status === "number" &&
    error.status >= 500
  ) {
    return {
      message:
        "The registration service is temporarily unavailable.",
      status: 503,
      fieldErrors: {},
    };
  }

  return {
    message: "Unable to create your account. Please try again.",
    status: 400,
    fieldErrors: {},
  };
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

  if (!isRegistrationInput(requestBody)) {
    return errorResponse(
      "Complete all required registration fields.",
      400,
    );
  }

  const validation = validateRegistrationInput(requestBody);

  if (hasRegistrationErrors(validation.errors)) {
    return errorResponse(
      "Correct the highlighted fields and try again.",
      400,
      validation.errors,
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return errorResponse(
      "The registration database is not configured.",
      503,
    );
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return errorResponse(
      "The authentication service is not configured.",
      503,
    );
  }

  try {
    const existingProfile = await prisma.profile.findUnique({
      where: {
        email: validation.data.email,
      },
      select: {
        id: true,
      },
    });

    if (existingProfile) {
      return errorResponse(
        "An account already exists for this email address.",
        409,
        {
          email:
            "An account already exists for this email address.",
        },
      );
    }
  } catch (error) {
    console.error(
      "[registration] Profile lookup failed:",
      error instanceof Error
        ? error.message
        : "Unknown database error",
    );

    return errorResponse(
      "The registration database is temporarily unavailable.",
      503,
    );
  }

  const applicationOrigin = getApplicationOriginFromRequest(request);
  const emailRedirectTo = `${applicationOrigin}/auth/callback`;

  try {
    const { data, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        emailRedirectTo,
        data: {
          first_name: validation.data.firstName,
          last_name: validation.data.lastName,
          full_name: `${validation.data.firstName} ${validation.data.lastName}`,
        },
      },
    });

    if (error) {
      const friendlyError = getFriendlySupabaseError(error);

      console.error(
        "[registration] Supabase signup failed:",
        error.code ?? error.message,
      );

      return errorResponse(
        friendlyError.message,
        friendlyError.status,
        friendlyError.fieldErrors,
      );
    }

    if (
      !data.user ||
      (Array.isArray(data.user.identities) &&
        data.user.identities.length === 0)
    ) {
      return errorResponse(
        "An account already exists for this email address.",
        409,
        {
          email:
            "An account already exists for this email address.",
        },
      );
    }

    const profileResult =
      await ensureProfileForSupabaseUser(data.user);

    if (
      profileResult.outcome === "error" ||
      profileResult.outcome === "unavailable" ||
      profileResult.outcome === "denied"
    ) {
      console.error(
        "[registration] Profile synchronization pending:",
        profileResult.outcome,
      );
    }

    const requiresEmailVerification = data.session === null;

    return NextResponse.json(
      {
        ok: true,
        message: requiresEmailVerification
          ? "Account created. Check your email to verify your account."
          : "Account created successfully.",
        requiresEmailVerification,
        redirectTo: requiresEmailVerification
          ? `/register/verify?email=${encodeURIComponent(
              validation.data.email,
            )}`
          : "/dashboard",
      },
      {
        status: 201,
        headers: createResponseHeaders(),
      },
    );
  } catch (error) {
    console.error(
      "[registration] Unexpected registration failure:",
      error instanceof Error
        ? error.message
        : "Unknown registration error",
    );

    return errorResponse(
      "A network or authentication service error occurred. Please try again.",
      503,
    );
  }
}