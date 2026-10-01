import "server-only";

import { timingSafeEqual } from "node:crypto";

export type OneLvAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function verifyOneLvAuthorization(headers: Headers): OneLvAuthResult {
  if (process.env.ONE_LV_SYNC_ENABLED !== "true") {
    return {
      ok: false,
      status: 503,
      error: "1LV synchronization is disabled.",
    };
  }

  const expected = process.env.ONE_LV_MASTER_API_KEY?.trim();

  if (!expected || expected.length < 32) {
    return {
      ok: false,
      status: 503,
      error: "1LV synchronization is not configured.",
    };
  }

  const authorization = headers.get("authorization")?.trim() ?? "";
  const received = authorization.replace(/^Bearer\s+/i, "");

  if (!received || !safeEqual(expected, received)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid integration credentials.",
    };
  }

  return { ok: true };
}
