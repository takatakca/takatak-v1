import "server-only";

import {
  decryptSocialValue,
  encryptSocialValue,
} from "@/lib/social/security/social-crypto";

export const FACEBOOK_OAUTH_HANDOFF_COOKIE =
  "takatak_fb_oauth_handoff";

export const FACEBOOK_OAUTH_HANDOFF_PATH =
  "/api/social/callback/facebook/handoff";

export const FACEBOOK_OAUTH_CALLBACK_PATH =
  "/api/social/callback/facebook";

const HANDOFF_MAX_AGE_SECONDS = 120;
/** Stay under typical 4KB cookie limits after encryption overhead. */
const HANDOFF_COOKIE_MAX_CHARS = 3500;

export type FacebookOAuthHandoffPayload = {
  code?: string;
  state?: string;
  error?: string;
  error_reason?: string;
  error_description?: string;
  sealedAt: string;
};

export function sealFacebookOAuthHandoff(
  fields: Omit<FacebookOAuthHandoffPayload, "sealedAt">,
): string {
  const payload: FacebookOAuthHandoffPayload = {
    ...fields,
    sealedAt: new Date().toISOString(),
  };

  const encrypted = encryptSocialValue(
    JSON.stringify(payload),
  );

  const packed = Buffer.from(
    JSON.stringify({
      c: encrypted.ciphertext,
      i: encrypted.iv,
      a: encrypted.authTag,
      v: encrypted.keyVersion,
    }),
    "utf8",
  ).toString("base64url");

  if (packed.length > HANDOFF_COOKIE_MAX_CHARS) {
    throw new Error("handoff_payload_too_large");
  }

  return packed;
}

export function unsealFacebookOAuthHandoff(
  packed: string,
): FacebookOAuthHandoffPayload {
  const raw = Buffer.from(packed, "base64url").toString(
    "utf8",
  );
  const parsed = JSON.parse(raw) as {
    c?: unknown;
    i?: unknown;
    a?: unknown;
    v?: unknown;
  };

  if (
    typeof parsed.c !== "string" ||
    typeof parsed.i !== "string" ||
    typeof parsed.a !== "string" ||
    typeof parsed.v !== "number"
  ) {
    throw new Error("handoff_payload_invalid");
  }

  const json = decryptSocialValue({
    ciphertext: parsed.c,
    iv: parsed.i,
    authTag: parsed.a,
    keyVersion: parsed.v,
  });

  const payload = JSON.parse(
    json,
  ) as FacebookOAuthHandoffPayload;

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sealedAt !== "string"
  ) {
    throw new Error("handoff_payload_invalid");
  }

  const sealedAt = Date.parse(payload.sealedAt);

  if (
    Number.isNaN(sealedAt) ||
    Date.now() - sealedAt > HANDOFF_MAX_AGE_SECONDS * 1000
  ) {
    throw new Error("handoff_payload_expired");
  }

  return payload;
}

export function facebookOAuthHandoffCookieOptions(origin: string): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  let secure = true;

  try {
    secure = new URL(origin).protocol === "https:";
  } catch {
    secure = process.env.NODE_ENV === "production";
  }

  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: FACEBOOK_OAUTH_CALLBACK_PATH,
    maxAge: HANDOFF_MAX_AGE_SECONDS,
  };
}

export function handoffPayloadToRawQuery(
  payload: FacebookOAuthHandoffPayload,
): Record<string, string | undefined> {
  return {
    code: payload.code,
    state: payload.state,
    error: payload.error,
    error_reason: payload.error_reason,
    error_description: payload.error_description,
  };
}
