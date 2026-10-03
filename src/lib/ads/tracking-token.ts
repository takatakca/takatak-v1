import "server-only";

import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "crypto";

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SECONDS = 30 * 60;

export type AdsTrackingTokenPayload = {
  v: 1;
  campaignId: string;
  creativeId: string;
  placementId: string;
  nonce: string;
  exp: number;
};

function signingSecret(): string | null {
  const secret = process.env.ADS_EVENT_SIGNING_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : null;
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

export function createAdsTrackingToken(input: {
  campaignId: string;
  creativeId: string;
  placementId: string;
  ttlSeconds?: number;
}): string | null {
  const secret = signingSecret();
  if (!secret) return null;

  const payload: AdsTrackingTokenPayload = {
    v: TOKEN_VERSION,
    campaignId: input.campaignId,
    creativeId: input.creativeId,
    placementId: input.placementId,
    nonce: randomUUID(),
    exp:
      Math.floor(Date.now() / 1000) +
      Math.max(60, input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };

  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyAdsTrackingToken(
  token: string,
): AdsTrackingTokenPayload | null {
  const secret = signingSecret();
  if (!secret) return null;

  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const provided = Buffer.from(providedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<AdsTrackingTokenPayload>;

    if (
      parsed.v !== TOKEN_VERSION ||
      typeof parsed.campaignId !== "string" ||
      typeof parsed.creativeId !== "string" ||
      typeof parsed.placementId !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsed as AdsTrackingTokenPayload;
  } catch {
    return null;
  }
}
