import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

export type GatewayAuthResult = { ok: true } | { ok: false; status: 401 | 503; message: string };

/**
 * Server-to-server auth for the TAKATAK AI Gateway. The shared token must be at
 * least 32 characters; otherwise the credit API stays disabled (503).
 */
export function verifyGatewayRequest(headers: Headers): GatewayAuthResult {
  const expected = process.env.TAKATAK_AI_GATEWAY_TOKEN?.trim() ?? "";
  if (expected.length < MIN_TOKEN_LENGTH) {
    return { ok: false, status: 503, message: "AI credit API is not configured." };
  }
  const header = headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!presented || !timingSafeEqual(a, b)) return { ok: false, status: 401, message: "Unauthorized." };
  return { ok: true };
}
