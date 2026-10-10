import "server-only";

// Growth Suite token encryption (AES-256-GCM, versioned key, context-bound AAD).
// Separate key from other modules: GROWTH_TOKEN_ENCRYPTION_KEY_V1 (32 bytes,
// Base64 or 64 hex chars). Mirrors the hockey calendar implementation.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function decodeKey(value: string): Buffer | null {
  const v = value.trim();
  if (!v) return null;
  if (/^[a-fA-F0-9]{64}$/.test(v)) return Buffer.from(v, "hex");
  try {
    const decoded = Buffer.from(v, "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function keyFor(version: number): Buffer {
  if (version !== 1) throw new Error(`growth_key_version_${version}_not_configured`);
  const key = decodeKey(process.env.GROWTH_TOKEN_ENCRYPTION_KEY_V1 ?? "");
  if (!key) throw new Error("GROWTH_TOKEN_ENCRYPTION_KEY_V1 must be 32 bytes (Base64 or 64 hex characters).");
  return key;
}

export function growthEncryptionConfigured(): boolean {
  try {
    keyFor(1);
    return true;
  } catch {
    return false;
  }
}

export function encryptGrowthValue(plaintext: string, aad: string): EncryptedValue {
  if (!plaintext) throw new Error("empty_plaintext");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFor(1), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), keyVersion: 1 };
}

export function decryptGrowthValue(value: EncryptedValue, aad: string): string {
  const decipher = createDecipheriv(ALGORITHM, keyFor(value.keyVersion), Buffer.from(value.iv, "base64"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

export function connectionAad(clientId: string, connectionId: string): string {
  return ["takatak-growth", "google-business", clientId, connectionId].join(":");
}

export function oauthStateAad(clientId: string, stateId: string): string {
  return ["takatak-growth", "google-business-oauth", clientId, stateId].join(":");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}
