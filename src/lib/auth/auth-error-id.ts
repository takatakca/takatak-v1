import { randomBytes } from "node:crypto";

/** Short public identifier for support. Never derived from secrets. */
export function createAuthErrorId(): string {
  const time = Date.now().toString(36);
  const nonce = randomBytes(6).toString("hex");
  return `atk_${time}_${nonce}`;
}
