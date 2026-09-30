import "server-only";
import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyOneLvRequest(headers: Headers):
  | { valid: true }
  | { valid: false; status: 401 | 503; error: string } {
  if (process.env.TAKATAK_1LV_SYNC_ENABLED !== "true") {
    return { valid: false, status: 503, error: "1LV synchronization is disabled." };
  }
  const expected = process.env.TAKATAK_1LV_API_KEY?.trim();
  if (!expected || expected.length < 32) {
    return { valid: false, status: 503, error: "1LV synchronization is not configured." };
  }
  const auth = headers.get("authorization")?.trim() ?? "";
  if (!auth.startsWith("Bearer ")) {
    return { valid: false, status: 401, error: "Missing integration bearer token." };
  }
  const received = auth.slice(7).trim();
  if (!same(expected, received)) {
    return { valid: false, status: 401, error: "Invalid integration credential." };
  }
  return { valid: true };
}
