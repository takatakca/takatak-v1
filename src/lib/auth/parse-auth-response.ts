export type AuthClientResult = {
  ok: boolean;
  status: number;
  message: string;
  errorId?: string;
  code?: string;
  redirectTo?: string;
  fieldErrors?: Record<string, string>;
  requiresEmailVerification?: boolean;
  kind:
    | "json"
    | "non_json"
    | "empty"
    | "network";
};

const FALLBACK_MESSAGES: Record<string, string> = {
  invalid_otp: "Invalid OTP recheck!",
  expired_otp: "That code has expired. Request a new one.",
  too_many_attempts: "Too many attempts. Request a new code.",
  disabled_account: "This account has been disabled.",
  configuration_unavailable:
    "The authentication service is not configured.",
  session_unavailable: "Unable to start a session. Please try again.",
  verification_unavailable:
    "The verification service is temporarily unavailable.",
  verification_in_progress:
    "Verification is already in progress. Please wait and try again.",
  otp_not_requested: "OTP not requested",
  email_not_found: "Email not found",
};

export function fallbackAuthMessage(
  code: string | undefined,
  fallback: string,
): string {
  if (code && FALLBACK_MESSAGES[code]) {
    return FALLBACK_MESSAGES[code];
  }
  return fallback;
}

export function formatAuthErrorMessage(result: AuthClientResult): string {
  const base =
    result.message.trim() ||
    fallbackAuthMessage(
      result.code,
      "The verification service is temporarily unavailable.",
    );
  if (result.errorId) {
    return `${base} (Reference: ${result.errorId})`;
  }
  return base;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export async function parseAuthResponse(
  response: Response,
): Promise<AuthClientResult> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const raw = await response.text();

  if (!raw.trim()) {
    return {
      ok: false,
      status: response.status,
      message: "The verification service returned an empty response.",
      kind: "empty",
      code: "verification_unavailable",
    };
  }

  const looksLikeJson =
    contentType.includes("application/json") ||
    raw.trim().startsWith("{") ||
    raw.trim().startsWith("[");

  if (!looksLikeJson || contentType.includes("text/html")) {
    if (!contentType.includes("application/json")) {
      return {
        ok: false,
        status: response.status,
        message:
          "The verification service is temporarily unavailable.",
        kind: "non_json",
        code: "verification_unavailable",
      };
    }
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {
        ok: false,
        status: response.status,
        message:
          "The verification service is temporarily unavailable.",
        kind: "non_json",
        code: "verification_unavailable",
      };
    }

    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message
        : fallbackAuthMessage(
            typeof parsed.code === "string" ? parsed.code : undefined,
            "The verification service is temporarily unavailable.",
          );
    const fieldErrors =
      isRecord(parsed.fieldErrors)
        ? Object.fromEntries(
            Object.entries(parsed.fieldErrors).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined;

    return {
      ok: parsed.ok === true,
      status: response.status,
      message,
      errorId:
        typeof parsed.errorId === "string" ? parsed.errorId : undefined,
      code: typeof parsed.code === "string" ? parsed.code : undefined,
      redirectTo:
        typeof parsed.redirectTo === "string"
          ? parsed.redirectTo
          : undefined,
      fieldErrors,
      requiresEmailVerification: parsed.requiresEmailVerification === true,
      kind: "json",
    };
  } catch {
    return {
      ok: false,
      status: response.status,
      message:
        "The verification service is temporarily unavailable.",
      kind: "non_json",
      code: "verification_unavailable",
    };
  }
}

export function isRetryableAuthFailure(result: AuthClientResult): boolean {
  if (result.kind !== "json") {
    return true;
  }
  return (
    result.code === "session_unavailable" ||
    result.code === "verification_unavailable" ||
    result.code === "database_unavailable" ||
    result.code === "verification_in_progress" ||
    result.status >= 500
  );
}
