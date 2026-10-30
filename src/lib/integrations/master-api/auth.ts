import "server-only";

import { timingSafeEqual } from "node:crypto";

import {
  MASTER_API_MIN_KEY_LENGTH,
  MASTER_API_SCOPE_ENV,
  type MasterApiScope,
} from "./scope";

function safeEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

// 1LV keeps its own application-scoped credential, TAKATAK_1LV_API_KEY: never a global master key, and never
// one of the other applications' keys (TAKATAK_ON2GO_API_KEY, TAKATAK_FOODHUB_API_KEY).
function configuredKey(scope: MasterApiScope): string | null {
  const envName = scope === "1lv" ? "TAKATAK_1LV_API_KEY" : MASTER_API_SCOPE_ENV[scope];
  const value = process.env[envName]?.trim() ?? "";
  return value.length >= MASTER_API_MIN_KEY_LENGTH ? value : null;
}

export type MasterApiVerification =
  | { valid: true; scope: MasterApiScope }
  | { valid: false; status: 401 | 503; error: string };

/**
 * Checks the bearer key against the keys of the scopes a route accepts (1LV only by default) and says which scope
 * matched. Each child application holds its own key: a key never opens another scope, and a route that does not
 * list a scope refuses that scope's key with 401 even when the key is right.
 */
export function verifyMasterApiRequest(
  headers: Headers,
  allowed: readonly MasterApiScope[] = ["1lv"],
): MasterApiVerification {
  const configured = allowed
    .map((scope) => ({ scope, key: configuredKey(scope) }))
    .filter((entry): entry is { scope: MasterApiScope; key: string } => entry.key !== null);

  if (configured.length === 0) {
    return {
      valid: false,
      status: 503,
      error:
        allowed.length === 1 && allowed[0] === "1lv"
          ? "TAKATAK 1LV integration API is not configured."
          : "TAKATAK master API is not configured for this integration.",
    };
  }

  const authorization = headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return {
      valid: false,
      status: 401,
      error: "Missing master API authorization.",
    };
  }

  const received = authorization.slice("Bearer ".length).trim();
  if (received) {
    for (const entry of configured) {
      if (safeEqual(entry.key, received)) {
        return { valid: true, scope: entry.scope };
      }
    }
  }

  return {
    valid: false,
    status: 401,
    error: "Invalid master API authorization.",
  };
}
