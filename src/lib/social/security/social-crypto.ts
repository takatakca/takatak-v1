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

export type EncryptedSocialValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
};

export type SocialTokenPayload = {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scopes?: string[];
  providerAccountId?: string | null;
  issuedAt?: string | null;
  metadata?: Record<string, unknown>;
};

/** Typed Page credential nested under the user token payload (never overwrites user accessToken). */
export const META_FACEBOOK_PAGE_CREDENTIAL_PURPOSE =
  "meta_facebook_page" as const;

export type MetaFacebookPageCredential = {
  purpose: typeof META_FACEBOOK_PAGE_CREDENTIAL_PURPOSE;
  pageId: string;
  accessToken: string;
  obtainedAt: string;
};

export function readMetaFacebookPageCredential(
  payload: SocialTokenPayload,
): MetaFacebookPageCredential | null {
  const raw = payload.metadata?.pageCredential;

  if (
    typeof raw !== "object" ||
    raw === null ||
    Array.isArray(raw)
  ) {
    return null;
  }

  const record = raw as Record<string, unknown>;

  if (
    record.purpose !== META_FACEBOOK_PAGE_CREDENTIAL_PURPOSE ||
    typeof record.pageId !== "string" ||
    !record.pageId.trim() ||
    typeof record.accessToken !== "string" ||
    !record.accessToken.trim() ||
    typeof record.obtainedAt !== "string" ||
    !record.obtainedAt.trim()
  ) {
    return null;
  }

  return {
    purpose: META_FACEBOOK_PAGE_CREDENTIAL_PURPOSE,
    pageId: record.pageId.trim(),
    accessToken: record.accessToken,
    obtainedAt: record.obtainedAt.trim(),
  };
}

/**
 * Preserve the authorized Meta user token and attach/replace the Page
 * credential under metadata.pageCredential only.
 */
export function withMetaFacebookPageCredential(
  payload: SocialTokenPayload,
  options: {
    pageId: string;
    accessToken: string;
    obtainedAt?: string;
  },
): SocialTokenPayload {
  if (!payload.accessToken.trim()) {
    throw new Error(
      "An access token is required.",
    );
  }

  if (!options.pageId.trim() || !options.accessToken.trim()) {
    throw new Error(
      "A Facebook Page id and Page access token are required.",
    );
  }

  const pageCredential: MetaFacebookPageCredential = {
    purpose: META_FACEBOOK_PAGE_CREDENTIAL_PURPOSE,
    pageId: options.pageId.trim(),
    accessToken: options.accessToken.trim(),
    obtainedAt:
      options.obtainedAt?.trim() ||
      new Date().toISOString(),
  };

  return {
    ...payload,
    metadata: {
      ...(payload.metadata ?? {}),
      pageCredential,
    },
  };
}

/**
 * Keep the authorized Meta user token and remove any nested Page credential.
 * Used when the user clears the selected Facebook Page to pick another.
 */
export function clearMetaFacebookPageCredential(
  payload: SocialTokenPayload,
): SocialTokenPayload {
  if (!payload.accessToken.trim()) {
    throw new Error(
      "An access token is required.",
    );
  }

  const metadata = {
    ...(payload.metadata ?? {}),
  };
  delete metadata.pageCredential;

  return {
    ...payload,
    metadata:
      Object.keys(metadata).length > 0
        ? metadata
        : undefined,
  };
}

type SocialEncryptionKey = {
  version: number;
  key: Buffer;
};

function decodeEncryptionKey(
  value: string,
): Buffer | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  try {
    const base64 = Buffer.from(
      normalized,
      "base64",
    );

    if (base64.length === 32) {
      return base64;
    }
  } catch {
    // Continue to hexadecimal decoding.
  }

  if (/^[a-fA-F0-9]{64}$/.test(normalized)) {
    const hexadecimal = Buffer.from(
      normalized,
      "hex",
    );

    if (hexadecimal.length === 32) {
      return hexadecimal;
    }
  }

  return null;
}

function getConfiguredKeys(): SocialEncryptionKey[] {
  const keys: SocialEncryptionKey[] = [];

  const versionOne =
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;

  if (versionOne) {
    const key = decodeEncryptionKey(
      versionOne,
    );

    if (!key) {
      throw new Error(
        "SOCIAL_TOKEN_ENCRYPTION_KEY_V1 must be a 32-byte Base64 value or a 64-character hexadecimal value.",
      );
    }

    keys.push({
      version: 1,
      key,
    });
  }

  return keys;
}

export function isSocialEncryptionConfigured(): boolean {
  try {
    return getConfiguredKeys().length > 0;
  } catch {
    return false;
  }
}

export function getActiveSocialEncryptionKeyVersion(): number {
  const configuredVersion = Number(
    process.env
      .SOCIAL_TOKEN_ACTIVE_KEY_VERSION ??
      "1",
  );

  if (
    !Number.isInteger(configuredVersion) ||
    configuredVersion < 1
  ) {
    throw new Error(
      "SOCIAL_TOKEN_ACTIVE_KEY_VERSION must be a positive integer.",
    );
  }

  return configuredVersion;
}

function getEncryptionKey(
  requestedVersion?: number,
): SocialEncryptionKey {
  const version =
    requestedVersion ??
    getActiveSocialEncryptionKeyVersion();

  const key = getConfiguredKeys().find(
    (candidate) =>
      candidate.version === version,
  );

  if (!key) {
    throw new Error(
      `Social encryption key version ${version} is not configured.`,
    );
  }

  return key;
}

export function encryptSocialValue(
  plaintext: string,
  keyVersion?: number,
  authenticatedContext?: string,
): EncryptedSocialValue {
  if (!plaintext) {
    throw new Error(
      "A non-empty value is required for encryption.",
    );
  }

  const encryptionKey =
    getEncryptionKey(keyVersion);

  const iv = randomBytes(IV_BYTES);

  const cipher = createCipheriv(
    ALGORITHM,
    encryptionKey.key,
    iv,
  );

  if (authenticatedContext) {
    cipher.setAAD(
      Buffer.from(
        authenticatedContext,
        "utf8",
      ),
    );
  }

  const ciphertext = Buffer.concat([
    cipher.update(
      plaintext,
      "utf8",
    ),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString(
      "base64",
    ),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion:
      encryptionKey.version,
  };
}

export function decryptSocialValue(
  value: EncryptedSocialValue,
  authenticatedContext?: string,
): string {
  const encryptionKey =
    getEncryptionKey(value.keyVersion);

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey.key,
    Buffer.from(value.iv, "base64"),
  );

  if (authenticatedContext) {
    decipher.setAAD(
      Buffer.from(
        authenticatedContext,
        "utf8",
      ),
    );
  }

  decipher.setAuthTag(
    Buffer.from(
      value.authTag,
      "base64",
    ),
  );

  const plaintext = Buffer.concat([
    decipher.update(
      Buffer.from(
        value.ciphertext,
        "base64",
      ),
    ),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export function buildSocialCredentialAad(
  options: {
    clientId: string;
    connectionId: string;
    provider: string;
  },
): string {
  return [
    "takatak-social-credential",
    options.clientId,
    options.connectionId,
    options.provider,
  ].join(":");
}

export function encryptSocialTokenPayload(
  payload: SocialTokenPayload,
  authenticatedContext?: string,
): EncryptedSocialValue {
  if (!payload.accessToken.trim()) {
    throw new Error(
      "An access token is required.",
    );
  }

  return encryptSocialValue(
    JSON.stringify(payload),
    undefined,
    authenticatedContext,
  );
}

export function decryptSocialTokenPayload(
  value: EncryptedSocialValue,
  authenticatedContext?: string,
): SocialTokenPayload {
  const plaintext =
    decryptSocialValue(
      value,
      authenticatedContext,
    );

  const parsed = JSON.parse(
    plaintext,
  ) as unknown;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "The encrypted social credential payload is invalid.",
    );
  }

  const payload =
    parsed as Partial<SocialTokenPayload>;

  if (
    typeof payload.accessToken !==
      "string" ||
    !payload.accessToken.trim()
  ) {
    throw new Error(
      "The encrypted social credential payload does not contain an access token.",
    );
  }

  return {
    accessToken: payload.accessToken,
    refreshToken:
      typeof payload.refreshToken ===
        "string"
        ? payload.refreshToken
        : null,
    tokenType:
      typeof payload.tokenType ===
        "string"
        ? payload.tokenType
        : null,
    scopes: Array.isArray(
      payload.scopes,
    )
      ? payload.scopes.filter(
          (
            scope,
          ): scope is string =>
            typeof scope === "string",
        )
      : [],
    providerAccountId:
      typeof payload.providerAccountId ===
        "string"
        ? payload.providerAccountId
        : null,
    issuedAt:
      typeof payload.issuedAt ===
        "string"
        ? payload.issuedAt
        : null,
    metadata:
      typeof payload.metadata ===
        "object" &&
      payload.metadata !== null &&
      !Array.isArray(
        payload.metadata,
      )
        ? payload.metadata
        : undefined,
  };
}

export function createOAuthStateValue(): string {
  return randomBytes(
    STATE_BYTES,
  ).toString("base64url");
}

export function hashOAuthState(
  state: string,
): string {
  return createHash("sha256")
    .update(state, "utf8")
    .digest("hex");
}

export function verifyOAuthStateHash(
  state: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(
    hashOAuthState(state),
    "hex",
  );

  let expected: Buffer;

  try {
    expected = Buffer.from(
      expectedHash,
      "hex",
    );
  } catch {
    return false;
  }

  if (
    actual.length !== expected.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actual,
    expected,
  );
}

export function createPkceVerifier(): string {
  return randomBytes(
    PKCE_BYTES,
  ).toString("base64url");
}

export function createPkceChallenge(
  verifier: string,
): string {
  return createHash("sha256")
    .update(verifier, "utf8")
    .digest("base64url");
}
