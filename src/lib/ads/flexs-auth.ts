import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(expected: string, received: string): boolean {
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyFlexsAdsRequest(
  headers: Headers,
):
  | { valid: true }
  | { valid: false; status: 401 | 503; error: string } {
  const expected =
    process.env.ADS_FLEXS_SERVICE_TOKEN?.trim() ?? "";

  if (expected.length < 32) {
    return {
      valid: false,
      status: 503,
      error: "FLEXS attribution is not configured.",
    };
  }

  const authorization =
    headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return {
      valid: false,
      status: 401,
      error: "Missing FLEXS service authorization.",
    };
  }

  const received = authorization
    .slice("Bearer ".length)
    .trim();

  if (!received || !safeEqual(expected, received)) {
    return {
      valid: false,
      status: 401,
      error: "Invalid FLEXS service authorization.",
    };
  }

  return { valid: true };
}
