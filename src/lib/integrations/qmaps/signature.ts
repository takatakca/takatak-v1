// QMAPS → TAKATAK request verification. Same scheme as the Rentauto
// integration (HMAC-SHA256 over `${timestamp}.${eventId}.${rawBody}`) with a
// credential dedicated to QMAPS — never reuse another app's secret.

import { createHmac, timingSafeEqual } from "node:crypto";

export const QMAPS_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type Env = Record<string, string | undefined>;

export type QmapsVerification =
  | { valid: true; eventId: string }
  | { valid: false; status: 401 | 503; error: string };

function safeCompareHex(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function signQmapsBody(
  secret: string,
  timestamp: string,
  eventId: string,
  rawBody: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${eventId}.${rawBody}`, "utf8")
    .digest("hex");
}

export function verifyQmapsRequest(
  rawBody: string,
  headers: Headers,
  now = Date.now(),
  env: Env = process.env,
): QmapsVerification {
  if (env.QMAPS_SYNC_ENABLED?.trim() !== "true") {
    return { valid: false, status: 503, error: "QMAPS synchronization is disabled." };
  }

  const expectedClientId = env.QMAPS_SYNC_CLIENT_ID?.trim() ?? "";
  const secret = env.QMAPS_SYNC_WEBHOOK_SECRET?.trim() ?? "";
  if (!expectedClientId || secret.length < 32) {
    return { valid: false, status: 503, error: "QMAPS synchronization is not configured." };
  }

  const clientId = headers.get("x-integration-id")?.trim();
  const eventId = headers.get("x-event-id")?.trim();
  const timestamp = headers.get("x-timestamp")?.trim();
  const signature = headers.get("x-signature")?.trim().replace(/^sha256=/i, "") ?? "";

  if (clientId !== expectedClientId || !eventId || !timestamp) {
    return { valid: false, status: 401, error: "Invalid integration headers." };
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isInteger(timestampSeconds) ||
    Math.abs(now - timestampSeconds * 1000) > QMAPS_MAX_CLOCK_SKEW_MS
  ) {
    return { valid: false, status: 401, error: "Request timestamp is outside the allowed window." };
  }

  if (!safeCompareHex(signQmapsBody(secret, timestamp, eventId, rawBody), signature)) {
    return { valid: false, status: 401, error: "Invalid request signature." };
  }

  return { valid: true, eventId };
}
