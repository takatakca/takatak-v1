import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export type EncryptedTravelValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export type HockeyTravelOrigin = {
  latitude: number;
  longitude: number;
};

function decodeKey(value: string): Buffer | null {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const base64 = Buffer.from(normalized, "base64");
    if (base64.length === 32) return base64;
  } catch {
    // Try hexadecimal below.
  }

  if (/^[a-fA-F0-9]{64}$/.test(normalized)) {
    const hexadecimal = Buffer.from(normalized, "hex");
    if (hexadecimal.length === 32) return hexadecimal;
  }

  return null;
}

function activeVersion(): number {
  const parsed = Number(
    process.env.HOCKEY_TRAVEL_ACTIVE_KEY_VERSION?.trim() || "1",
  );
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      "HOCKEY_TRAVEL_ACTIVE_KEY_VERSION must be a positive integer.",
    );
  }
  return parsed;
}

function keyFor(version = activeVersion()): Buffer {
  if (version !== 1) {
    throw new Error(
      `Hockey travel encryption key version ${version} is not configured.`,
    );
  }

  const raw = process.env.HOCKEY_TRAVEL_ENCRYPTION_KEY_V1?.trim() || "";
  const key = decodeKey(raw);
  if (!key) {
    throw new Error(
      "HOCKEY_TRAVEL_ENCRYPTION_KEY_V1 must be a 32-byte Base64 value or a 64-character hexadecimal value.",
    );
  }
  return key;
}

export function isHockeyTravelEncryptionConfigured(): boolean {
  try {
    keyFor();
    return true;
  } catch {
    return false;
  }
}

export function hockeyTravelAad(input: {
  identityId: string;
  profileId: string;
}): string {
  return [
    "takatak-hockey-travel-origin",
    input.identityId,
    input.profileId,
  ].join(":");
}

export function encryptHockeyTravelOrigin(
  origin: HockeyTravelOrigin,
  aad: string,
): EncryptedTravelValue {
  const version = activeVersion();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyFor(version), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));

  const plaintext = JSON.stringify(origin);
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

export function decryptHockeyTravelOrigin(
  value: EncryptedTravelValue,
  aad: string,
): HockeyTravelOrigin {
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFor(value.keyVersion),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid encrypted hockey travel origin.");
  }

  const record = parsed as Record<string, unknown>;
  const latitude = record.latitude;
  const longitude = record.longitude;

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid encrypted hockey travel coordinates.");
  }

  return { latitude, longitude };
}
