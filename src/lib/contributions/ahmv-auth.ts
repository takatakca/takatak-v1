import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyAhmvContentRequest(headers: Headers):
  | { valid: true }
  | { valid: false; status: 401 | 403 | 503; error: string } {
  const expected = process.env.TAKATAK_AHMV_CONTENT_TOKEN?.trim() ?? "";
  if (expected.length < 32) {
    return {
      valid: false,
      status: 503,
      error: "AHMV content contribution service is not configured.",
    };
  }

  const tenant = headers.get("x-ahmv-tenant")?.trim().toLowerCase() ?? "";
  if (tenant !== "ahmverdun") {
    return { valid: false, status: 403, error: "Invalid AHMV tenant." };
  }

  const authorization = headers.get("authorization")?.trim() ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { valid: false, status: 401, error: "Missing AHMV content authorization." };
  }

  const received = authorization.slice("Bearer ".length).trim();
  if (!received || !safeEqual(expected, received)) {
    return { valid: false, status: 401, error: "Invalid AHMV content authorization." };
  }

  return { valid: true };
}
