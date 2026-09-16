import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

function safeCompareHex(
  expected: string,
  received: string,
): boolean {
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

export function verifyR2NetteRequest(
  rawBody: string,
  headers: Headers,
  now = Date.now(),
):
  | { valid: true; eventId: string }
  | { valid: false; status: 401 | 503; error: string } {
  if (process.env.R2NETTE_SYNC_ENABLED !== "true") {
    return {
      valid: false,
      status: 503,
      error: "R2NETTE synchronization is disabled.",
    };
  }

  const expectedClientId =
    process.env.R2NETTE_SYNC_CLIENT_ID?.trim();

  const secret =
    process.env.R2NETTE_SYNC_WEBHOOK_SECRET?.trim();

  if (!expectedClientId || !secret) {
    return {
      valid: false,
      status: 503,
      error: "R2NETTE synchronization is not configured.",
    };
  }

  const clientId =
    headers.get("x-integration-id")?.trim();

  const eventId =
    headers.get("x-event-id")?.trim();

  const timestamp =
    headers.get("x-timestamp")?.trim();

  const signature =
    headers
      .get("x-signature")
      ?.trim()
      .replace(/^sha256=/i, "") ?? "";

  if (
    clientId !== expectedClientId ||
    !eventId ||
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
    Math.abs(now - timestampSeconds * 1000) >
      5 * 60 * 1000
  ) {
    return {
      valid: false,
      status: 401,
      error: "Request timestamp is outside the allowed window.",
    };
  }

  const expectedSignature = createHmac(
    "sha256",
    secret,
  )
    .update(
      `${timestamp}.${eventId}.${rawBody}`,
      "utf8",
    )
    .digest("hex");

  if (!safeCompareHex(expectedSignature, signature)) {
    return {
      valid: false,
      status: 401,
      error: "Invalid request signature.",
    };
  }

  return {
    valid: true,
    eventId,
  };
}