import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Child applications allowed to call the master API. Each one has its own
 * dedicated credential — a key is never shared between applications, and the
 * key that authenticated a request decides which application it speaks for.
 */
export const MASTER_API_APPLICATIONS = {
  "1lv": "TAKATAK_1LV_API_KEY",
  isexy: "TAKATAK_ISEXY_API_KEY",
} as const;

export type MasterApiApplication = keyof typeof MASTER_API_APPLICATIONS;

export function verifyMasterApiRequest(
  headers: Headers,
  allowedApplications: readonly MasterApiApplication[] = ["1lv"],
):
  | { valid: true; application: MasterApiApplication }
  | { valid: false; status: 401 | 503; error: string } {
  const configured = allowedApplications
    .map((application) => ({
      application,
      key: process.env[MASTER_API_APPLICATIONS[application]]?.trim() ?? "",
    }))
    .filter((entry) => entry.key.length >= 32);

  if (configured.length === 0) {
    return {
      valid: false,
      status: 503,
      error: "TAKATAK master API is not configured for this application.",
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
  // Compare against every configured key so timing does not reveal which
  // application a guessed key belongs to.
  let matched: MasterApiApplication | null = null;
  for (const entry of configured) {
    if (received && safeEqual(entry.key, received) && !matched) {
      matched = entry.application;
    }
  }

  if (!matched) {
    return {
      valid: false,
      status: 401,
      error: "Invalid master API authorization.",
    };
  }

  return { valid: true, application: matched };
}
