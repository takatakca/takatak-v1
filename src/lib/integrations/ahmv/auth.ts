import "server-only";

import { timingSafeEqual } from "node:crypto";

export type AhmvScheduleCredential = "read" | "ingest";

function safeEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function tokenFor(mode: AhmvScheduleCredential): string {
  return (
    mode === "ingest"
      ? process.env.TAKATAK_AHMV_INGEST_TOKEN
      : process.env.TAKATAK_AHMV_SERVICE_TOKEN
  )?.trim() ?? "";
}

export function verifyAhmvScheduleRequest(
  headers: Headers,
  mode: AhmvScheduleCredential,
):
  | { valid: true }
  | { valid: false; status: 401 | 403 | 503; error: string } {
  const expected = tokenFor(mode);
  if (expected.length < 32) {
    return {
      valid: false,
      status: 503,
      error:
        mode === "ingest"
          ? "AHMV schedule ingestion is not configured."
          : "AHMV schedule service is not configured.",
    };
  }

  const tenant = headers.get("x-ahmv-tenant")?.trim().toLowerCase() ?? "";
  if (tenant !== "ahmverdun") {
    return {
      valid: false,
      status: 403,
      error: "Invalid AHMV tenant.",
    };
  }

  const authorization = headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return {
      valid: false,
      status: 401,
      error: "Missing AHMV service authorization.",
    };
  }

  const received = authorization.slice("Bearer ".length).trim();
  if (!received || !safeEqual(expected, received)) {
    return {
      valid: false,
      status: 401,
      error: "Invalid AHMV service authorization.",
    };
  }

  return { valid: true };
}
