// GROUPE TAKATAK Billing — short-lived server-to-server token for Facturations.
// Pure module (node:crypto only). The token is minted per request on the
// TAKATAK server and must never reach a browser, URL, storage or log.
//
// Exact claim set required by Facturations src/integration-auth.js:
//   { version: 1, iss, aud, sub, business_id, roles, iat, exp, jti }
// HS256 only, lifetime <= 90 s, fresh jti per token.

import { createHmac, randomUUID } from "node:crypto";

export type FacturationsRole = "OWNER" | "STAFF";

export const FACTURATIONS_TOKEN_LIFETIME_SECONDS = 60;
export const FACTURATIONS_TOKEN_MAX_LIFETIME_SECONDS = 90;

const JTI_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

export interface FacturationsTokenInput {
  secret: string;
  issuer: string;
  audience: string;
  subject: string;
  businessId: string;
  roles: readonly FacturationsRole[];
  nowMs?: number;
  lifetimeSeconds?: number;
  jti?: string;
}

export interface FacturationsTokenClaims {
  version: 1;
  iss: string;
  aud: string;
  sub: string;
  business_id: string;
  roles: FacturationsRole[];
  iat: number;
  exp: number;
  jti: string;
}

export class FacturationsTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacturationsTokenError";
  }
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function createFacturationsServiceToken(
  input: FacturationsTokenInput,
): string {
  const lifetime =
    input.lifetimeSeconds ?? FACTURATIONS_TOKEN_LIFETIME_SECONDS;
  const jti = input.jti ?? randomUUID();
  const roles = [...new Set(input.roles)];

  if (typeof input.secret !== "string" || input.secret.length < 32) {
    throw new FacturationsTokenError("Integration secret is not configured.");
  }

  if (!input.issuer || !input.audience || !input.businessId) {
    throw new FacturationsTokenError("Integration claims are not configured.");
  }

  if (input.subject.length < 8 || input.subject.length > 200) {
    throw new FacturationsTokenError("Integration subject is invalid.");
  }

  if (
    roles.length < 1 ||
    roles.length > 2 ||
    roles.some((role) => role !== "OWNER" && role !== "STAFF")
  ) {
    throw new FacturationsTokenError("Integration role is invalid.");
  }

  if (
    !Number.isInteger(lifetime) ||
    lifetime < 1 ||
    lifetime > FACTURATIONS_TOKEN_MAX_LIFETIME_SECONDS
  ) {
    throw new FacturationsTokenError("Integration token lifetime is invalid.");
  }

  if (!JTI_PATTERN.test(jti)) {
    throw new FacturationsTokenError("Integration token id is invalid.");
  }

  const iat = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const claims: FacturationsTokenClaims = {
    version: 1,
    iss: input.issuer,
    aud: input.audience,
    sub: input.subject,
    business_id: input.businessId,
    roles,
    iat,
    exp: iat + lifetime,
    jti,
  };

  const signingInput = `${base64UrlJson({ alg: "HS256", typ: "JWT" })}.${base64UrlJson(claims)}`;
  const signature = createHmac("sha256", input.secret)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}
