import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Growth cron auth: Authorization: Bearer <CRON_SECRET> (or x-cron-secret).
 * Without a secret it only runs outside production, like the existing cron routes.
 */
export function cronAuthorized(headers: Headers): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : (headers.get("x-cron-secret")?.trim() ?? "");
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();
  return Boolean(presented) && timingSafeEqual(a, b);
}
