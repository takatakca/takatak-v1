import { randomBytes } from "node:crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 30 * 1000;
export const MAX_VERIFY_ATTEMPTS = 5;
export const OTP_RESERVATION_LEASE_MS = 45 * 1000;
export const PENDING_OTP_PREFIX = "pending.v1:";

/**
 * Prisma `otpHash String?` maps to PostgreSQL TEXT. A pending.v1 value is
 * prefix + lease + nonce + original scrypt `salt:hex` (~140 bytes).
 */
export const OTP_HASH_TEXT_BUDGET_CHARS = 1024;

export type ParsedOtpRecord =
  | { kind: "hash"; hash: string }
  | {
      kind: "pending";
      hash: string;
      leaseUntil: number;
      nonce: string;
    };

export function encodePendingOtp(
  hash: string,
  leaseUntil: number,
  nonce = randomBytes(8).toString("hex"),
): string {
  return `${PENDING_OTP_PREFIX}${leaseUntil}.${nonce}.${hash}`;
}

export function parseStoredOtp(
  stored: string | null | undefined,
  now = Date.now(),
): ParsedOtpRecord | null {
  if (!stored) {
    return null;
  }

  if (!stored.startsWith(PENDING_OTP_PREFIX)) {
    return { kind: "hash", hash: stored };
  }

  const payload = stored.slice(PENDING_OTP_PREFIX.length);
  const firstDot = payload.indexOf(".");
  const secondDot = payload.indexOf(".", firstDot + 1);
  if (firstDot < 1 || secondDot < firstDot + 2) {
    return null;
  }

  const leaseUntil = Number(payload.slice(0, firstDot));
  const nonce = payload.slice(firstDot + 1, secondDot);
  const hash = payload.slice(secondDot + 1);
  if (!Number.isFinite(leaseUntil) || !nonce || !hash) {
    return null;
  }

  if (now > leaseUntil) {
    return { kind: "hash", hash };
  }

  return { kind: "pending", hash, leaseUntil, nonce };
}

export function usableOtpHash(
  stored: string | null | undefined,
  now = Date.now(),
): string | null {
  const parsed = parseStoredOtp(stored, now);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === "pending") {
    return null;
  }
  return parsed.hash;
}

export function isOtpReservationActive(
  stored: string | null | undefined,
  now = Date.now(),
): boolean {
  return parseStoredOtp(stored, now)?.kind === "pending";
}
