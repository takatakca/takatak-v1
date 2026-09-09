import "server-only";

import {
  decryptSocialValue,
  encryptSocialValue,
} from "@/lib/social/security/social-crypto";

const HANDOFF_MAX_AGE_SECONDS = 120;
const HANDOFF_COOKIE_MAX_CHARS = 3500;

export type DirectOAuthHandoffPayload = {
  code?: string;
  state?: string;
  error?: string;
  error_reason?: string;
  error_description?: string;
  sealedAt: string;
};

export function sealDirectOAuthHandoff(
  fields: Omit<DirectOAuthHandoffPayload, "sealedAt">,
): string {
  const payload: DirectOAuthHandoffPayload = {
    ...fields,
    sealedAt: new Date().toISOString(),
  };

  const encrypted = encryptSocialValue(JSON.stringify(payload));
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

export function unsealDirectOAuthHandoff(
  packed: string,
): DirectOAuthHandoffPayload {
  const raw = Buffer.from(packed, "base64url").toString("utf8");
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

  const payload = JSON.parse(json) as DirectOAuthHandoffPayload;

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

export function directOAuthHandoffCookieOptions(options: {
  origin: string;
  callbackPath: string;
}): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  let secure = true;
  try {
    secure = new URL(options.origin).protocol === "https:";
  } catch {
    secure = process.env.NODE_ENV === "production";
  }

  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: options.callbackPath,
    maxAge: HANDOFF_MAX_AGE_SECONDS,
  };
}

export function handoffPayloadToRawQuery(
  payload: DirectOAuthHandoffPayload,
): Record<string, string | undefined> {
  return {
    code: payload.code,
    state: payload.state,
    error: payload.error,
    error_reason: payload.error_reason,
    error_description: payload.error_description,
  };
}
