// Google service-account JWT (RFC 7523) — pure signing helper (node:crypto only).

import { createSign } from "node:crypto";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function normalizePrivateKey(raw: string): string {
  // Env files usually carry the PEM with literal "\n" sequences.
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function buildServiceAccountAssertion(input: {
  clientEmail: string;
  privateKeyPem: string;
  scopes: string[];
  nowSeconds?: number;
}): string {
  const iat = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: input.clientEmail,
      scope: input.scopes.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(normalizePrivateKey(input.privateKeyPem)).toString("base64url");
  return `${header}.${claims}.${signature}`;
}
