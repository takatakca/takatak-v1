import { createHash, randomBytes } from "node:crypto";

import { slugBase } from "./validation";

/** Public request tokens are random; only their SHA-256 is stored. */
export function newRequestToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashRequestToken(token) };
}

export function hashRequestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedRequestToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32}$/.test(token);
}

export function newPublicSlug(name: string): string {
  const suffix = randomBytes(4).toString("hex").slice(0, 6);
  return `${slugBase(name)}-${suffix}`;
}
