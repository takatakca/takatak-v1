import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const STATE_BYTES = 32;
const PKCE_BYTES = 64;

export type EncryptedHockeyValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export type HockeyGoogleTokenPayload = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  scopes: string[];
  externalAccountId: string | null;
  issuedAt: string;
};

function decodeKey(value: string): Buffer | null {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const decoded = Buffer.from(normalized, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Try hex below.
  }

  if (/^[a-fA-F0-9]{64}$/.test(normalized)) {
    const decoded = Buffer.from(normalized, "hex");
    if (decoded.length === 32) return decoded;
  }

  return null;
}

function keyVersion(): number {
  const parsed = Number(process.env.HOCKEY_TOKEN_ACTIVE_KEY_VERSION?.trim() || "1");
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("HOCKEY_TOKEN_ACTIVE_KEY_VERSION must be a positive integer.");
  }
  return parsed;
}

function keyFor(version = keyVersion()): Buffer {
  if (version !== 1) {
    throw new Error(`Hockey encryption key version ${version} is not configured.`);
  }

  const raw = process.env.HOCKEY_TOKEN_ENCRYPTION_KEY_V1?.trim() || "";
  const key = decodeKey(raw);
  if (!key) {
    throw new Error(
      "HOCKEY_TOKEN_ENCRYPTION_KEY_V1 must be a 32-byte Base64 value or a 64-character hexadecimal value.",
    );
  }
  return key;
}

export function isHockeyTokenEncryptionConfigured(): boolean {
  try {
    keyFor();
    return true;
  } catch {
    return false;
  }
}

export function encryptHockeyValue(
  plaintext: string,
  authenticatedContext?: string,
): EncryptedHockeyValue {
  if (!plaintext) throw new Error("A non-empty value is required for encryption.");

  const version = keyVersion();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyFor(version), iv);

  if (authenticatedContext) {
    cipher.setAAD(Buffer.from(authenticatedContext, "utf8"));
  }

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: version,
  };
}

export function decryptHockeyValue(
  value: EncryptedHockeyValue,
  authenticatedContext?: string,
): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFor(value.keyVersion),
    Buffer.from(value.iv, "base64"),
  );

  if (authenticatedContext) {
    decipher.setAAD(Buffer.from(authenticatedContext, "utf8"));
  }

  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function calendarConnectionAad(input: {
  identityId: string;
  connectionId: string;
}): string {
  return ["takatak-hockey-calendar", input.identityId, input.connectionId, "google"].join(":");
}

export function calendarOAuthStateAad(input: {
  identityId: string;
  stateId: string;
}): string {
  return ["takatak-hockey-calendar-state", input.identityId, input.stateId].join(":");
}

export function encryptHockeyGoogleTokenPayload(
  payload: HockeyGoogleTokenPayload,
  aad: string,
): EncryptedHockeyValue {
  if (!payload.accessToken.trim()) throw new Error("An access token is required.");
  return encryptHockeyValue(JSON.stringify(payload), aad);
}

export function decryptHockeyGoogleTokenPayload(
  value: EncryptedHockeyValue,
  aad: string,
): HockeyGoogleTokenPayload {
  const parsed = JSON.parse(decryptHockeyValue(value, aad)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid encrypted Google Calendar credential.");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.accessToken !== "string" || !record.accessToken.trim()) {
    throw new Error("Encrypted Google Calendar credential has no access token.");
  }

  return {
    accessToken: record.accessToken,
    refreshToken:
      typeof record.refreshToken === "string" && record.refreshToken.trim()
        ? record.refreshToken
        : null,
    tokenType:
      typeof record.tokenType === "string" && record.tokenType.trim()
        ? record.tokenType
        : null,
    scopes: Array.isArray(record.scopes)
      ? record.scopes.filter((scope): scope is string => typeof scope === "string")
      : [],
    externalAccountId:
      typeof record.externalAccountId === "string" && record.externalAccountId.trim()
        ? record.externalAccountId
        : null,
    issuedAt:
      typeof record.issuedAt === "string" && record.issuedAt.trim()
        ? record.issuedAt
        : new Date(0).toISOString(),
  };
}

export function createHockeyOAuthState(): string {
  return randomBytes(STATE_BYTES).toString("base64url");
}

export function hashHockeyOAuthState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export function verifyHockeyOAuthState(state: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashHockeyOAuthState(state), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createHockeyPkceVerifier(): string {
  return randomBytes(PKCE_BYTES).toString("base64url");
}

export function createHockeyPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}
