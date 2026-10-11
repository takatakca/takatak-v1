import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const REVERS_INTEGRATION_ID = "revers";
export const REVERS_EVENTS_PATH = "/api/v1/integrations/revers/events";

export function sha256Hex(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

export function verifyReversHmac(input: {
  secret: string;
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  body: string;
  signature: string;
  maxSkewSeconds?: number;
}): boolean {
  const timestampNumber = Number(input.timestamp);
  if (!Number.isInteger(timestampNumber)) return false;

  const skew = Math.abs(Math.floor(Date.now() / 1000) - timestampNumber);
  if (skew > (input.maxSkewSeconds ?? 300)) return false;

  const signingInput = [
    input.timestamp,
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    sha256Hex(input.body),
  ].join("");

  const expected = createHmac("sha256", input.secret)
    .update(signingInput, "utf8")
    .digest("hex");

  const actualBuffer = Buffer.from(input.signature.trim(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
