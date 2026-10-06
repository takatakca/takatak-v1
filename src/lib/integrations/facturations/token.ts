// Mints the short-lived HS256 service token defined by the Facturations
// /integration/v1 contract (docs/takatak-dashboard-integration-handoff-v1.md
// in takatakca/Facturations). Claims must match that contract exactly:
// Facturations rejects unknown or missing claims and tokens living > 90 s.

import { createHmac, randomUUID } from "node:crypto";

export type FacturationsRole = "OWNER" | "STAFF";

export const FACTURATIONS_TOKEN_TTL_SECONDS = 60;

export interface FacturationsTokenInput {
  secret: string;
  issuer: string;
  audience: string;
  subject: string;
  businessId: string;
  roles: readonly FacturationsRole[];
  nowMs?: number;
  jti?: string;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function createFacturationsServiceToken(
  input: FacturationsTokenInput,
): string {
  if (input.secret.length < 32) {
    throw new Error("Facturations integration secret is too short.");
  }
  if (input.subject.length < 8 || input.subject.length > 200) {
    throw new Error("Facturations token subject is invalid.");
  }
  if (input.roles.length < 1 || input.roles.length > 2) {
    throw new Error("Facturations token roles are invalid.");
  }

  const iat = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    version: 1,
    iss: input.issuer,
    aud: input.audience,
    sub: input.subject,
    business_id: input.businessId,
    roles: [...input.roles],
    iat,
    exp: iat + FACTURATIONS_TOKEN_TTL_SECONDS,
    jti: input.jti ?? randomUUID(),
  };

  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createHmac("sha256", input.secret)
    .update(signingInput, "utf8")
    .digest("base64url");

  return `${signingInput}.${signature}`;
}
