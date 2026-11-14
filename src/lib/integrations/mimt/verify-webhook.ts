import { createHmac, timingSafeEqual } from "node:crypto";

// MIMT sends X-MIMT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256>.
// The signature covers "<timestamp>.<exact raw JSON body>". Do not parse or
// normalize the body before computing the HMAC.
const SIGNATURE_RE = /^t=([0-9]{10,12}),v1=([a-fA-F0-9]{64})$/;
const MAX_SKEW_SECONDS = 300;

export function verifyMimtWebhook(
  body: string,
  signature: string | null,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret) || !signature) return false;
  const match = SIGNATURE_RE.exec(signature.trim());
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_SKEW_SECONDS) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(match[1] + "." + body).digest();
  const received = Buffer.from(match[2], "hex");
  return received.length === expected.length && timingSafeEqual(expected, received);
}
