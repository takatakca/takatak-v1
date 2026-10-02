import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyMasterApiRequest(
  headers: Headers,
):
  | { valid: true }
  | { valid: false; status: 401 | 503; error: string } {
  // This API surface is scoped to the 1LV integration. Never reuse one
  // child-application credential as a global master key.
  const expected = process.env.TAKATAK_1LV_API_KEY?.trim() ?? "";
  if (expected.length < 32) {
    return {
      valid: false,
      status: 503,
      error: "TAKATAK 1LV integration API is not configured.",
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
  if (!received || !safeEqual(expected, received)) {
    return {
      valid: false,
      status: 401,
      error: "Invalid master API authorization.",
    };
  }

  return { valid: true };
}
