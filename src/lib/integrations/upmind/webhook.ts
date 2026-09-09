// Upmind webhook signature check.
// Official rule: X-Webhook-Signature is HMAC-SHA256(hex) of the raw body
// using the endpoint secret. https://docs.upmind.com/docs/consuming-webhooks
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import {
  getUpmindEnvStatus,
  getUpmindWebhookSecret,
} from "./env";
import type { UpmindWebhookVerificationResult } from "./types";

function readSignatureHeader(headers: Headers): string {
  const raw =
    headers.get("x-webhook-signature") ??
    headers.get("X-Webhook-Signature") ??
    "";
  return raw.trim().toLowerCase().replace(/^sha256=/, "");
}

function hexBuffersEqual(expectedHex: string, receivedHex: string): boolean {
  if (!/^[0-9a-f]+$/.test(expectedHex) || !/^[0-9a-f]+$/.test(receivedHex)) {
    return false;
  }
  if (expectedHex.length !== receivedHex.length) {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}

export function verifyUpmindWebhook(
  rawBody: string,
  headers: Headers,
): UpmindWebhookVerificationResult {
  const env = getUpmindEnvStatus();
  if (!env.webhookEnabled) {
    return {
      state: "disabled",
      trusted: false,
      message:
        "Upmind webhooks are disabled (UPMIND_WEBHOOK_ENABLED is not true).",
    };
  }

  const secret = getUpmindWebhookSecret();
  if (!secret) {
    return {
      state: "not_configured",
      trusted: false,
      message:
        "Webhook secret is not configured (UPMIND_WEBHOOK_SECRET missing).",
    };
  }

  const received = readSignatureHeader(headers);
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  if (!received || !hexBuffersEqual(expected, received)) {
    return {
      state: "invalid_signature",
      trusted: false,
      message: "Webhook signature did not match.",
    };
  }

  return {
    state: "verified",
    trusted: true,
    message: "Webhook signature verified.",
  };
}
