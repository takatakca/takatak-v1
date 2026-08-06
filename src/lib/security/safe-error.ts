// Phase 14 — Convert unknown errors into safe messages. Raw stacks and
// secrets never reach UI or API responses; development logs keep useful
// diagnostics after redaction.
import { redactSecrets } from "./redact";

export interface SafeError {
  message: string; // safe for UI/API
  code?: string;
  requestId?: string;
}

/** Safe, generic message for callers; redacted detail logged server-side. */
export function toSafeError(error: unknown, options?: { code?: string; requestId?: string; scope?: string }): SafeError {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  // Server-side diagnostic (redacted, no stack in production logs by default).
  console.error(
    `[safe-error]${options?.scope ? ` [${options.scope}]` : ""}`,
    redactSecrets(detail),
  );
  return {
    message: "An internal error occurred. The details were logged safely.",
    code: options?.code,
    requestId: options?.requestId,
  };
}
