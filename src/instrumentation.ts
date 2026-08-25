/**
 * Next.js instrumentation — request error reporting with OAuth redaction.
 * Hosting/platform access logs are outside app control; application
 * error reporting never echoes callback query strings.
 */
import {
  redactSecrets,
  sanitizeRequestPathForLog,
} from "@/lib/security/redact";

export async function register() {
  // No boot-time side effects.
}

export function onRequestError(
  error: { digest?: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { get(name: string): string | null };
  },
  context: { routerKind: string; routePath: string },
) {
  const path = sanitizeRequestPathForLog(
    request.path || context.routePath,
  );

  console.error(
    "[onRequestError]",
    JSON.stringify({
      stage: "request_error",
      outcome: "failed",
      path,
      method: request.method,
      routerKind: context.routerKind,
      digest: error.digest ?? null,
      message: redactSecrets(error.message || "unknown"),
      at: new Date().toISOString(),
    }),
  );
}
