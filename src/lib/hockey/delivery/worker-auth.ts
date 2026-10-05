import "server-only";

import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyHockeyDeliveryWorker(request: Request):
  | { valid: true }
  | { valid: false; status: 401 | 503; error: string } {
  if (process.env.HOCKEY_DELIVERY_WORKER_ENABLED !== "true") {
    return { valid: false, status: 503, error: "Hockey delivery worker is disabled." };
  }

  const secret = process.env.HOCKEY_DELIVERY_WORKER_SECRET?.trim() ?? "";
  if (!secret) {
    return { valid: false, status: 503, error: "Hockey delivery worker is not configured." };
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (!token || !safeEqual(token, secret)) {
    return { valid: false, status: 401, error: "Unauthorized." };
  }

  return { valid: true };
}
