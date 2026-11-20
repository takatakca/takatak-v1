import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { R2FIntakeConfig } from "./config";

const WINDOW_MS = 5 * 60 * 1000;

function safeCompareHex(expected: string, received: string): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(expected) ||
    !/^[a-f0-9]{64}$/i.test(received)
  ) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex"),
  );
}

export function verifyR2FRequest(
  rawBody: string,
  headers: Headers,
  config: R2FIntakeConfig,
  now = Date.now(),
):
  | { valid: true; eventId: string }
  | { valid: false; status: 401 | 503; error: string } {
  if (!config.enabled) {
    return {
      valid: false,
      status: 503,
      error: "R2F intake is disabled or not configured.",
    };
  }

  const integrationId = headers.get("x-integration-id")?.trim();
  const eventId = headers.get("x-event-id")?.trim();
  const timestamp = headers.get("x-timestamp")?.trim();
  const signature =
    headers.get("x-signature")?.trim().replace(/^sha256=/i, "") ?? "";

  if (
    integrationId !== config.integrationId ||
    !eventId ||
    eventId.length > 160 ||
    !timestamp
  ) {
    return {
      valid: false,
      status: 401,
      error: "Invalid integration headers.",
    };
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isInteger(timestampSeconds) ||
    Math.abs(now - timestampSeconds * 1000) > WINDOW_MS
  ) {
    return {
      valid: false,
      status: 401,
      error: "Request timestamp is outside the allowed window.",
    };
  }

  const expected = createHmac("sha256", config.secret)
    .update(`${timestamp}.${eventId}.${rawBody}`, "utf8")
    .digest("hex");

  if (!safeCompareHex(expected, signature)) {
    return {
      valid: false,
      status: 401,
      error: "Invalid request signature.",
    };
  }

  return { valid: true, eventId };
}
