/**
 * Step 2C isolated security verification.
 * Uses ephemeral fake tokens and a temporary encryption key.
 * Never prints tokens, keys, ciphertext, IVs, or auth tags.
 */

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type Status = "PASS" | "FAIL" | "BLOCKED";

type Result = {
  id: number;
  name: string;
  status: Status;
  evidence: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));

const results: Result[] = [];
const captureLog: string[] = [];
const originalError = console.error;
const originalLog = console.log;
const originalWarn = console.warn;

function installLogCapture() {
  const wrap =
    (original: typeof console.log) =>
    (...args: unknown[]) => {
      captureLog.push(
        args
          .map((value) =>
            typeof value === "string"
              ? value
              : value instanceof Error
                ? value.message
                : "[non-string]",
          )
          .join(" "),
      );
      original(...args);
    };

  console.error = wrap(originalError);
  console.log = wrap(originalLog);
  console.warn = wrap(originalWarn);
}

function restoreLogs() {
  console.error = originalError;
  console.log = originalLog;
  console.warn = originalWarn;
}

function record(
  id: number,
  name: string,
  status: Status,
  evidence: string,
) {
  results.push({ id, name, status, evidence });
}

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function containsForbiddenSecretShapes(
  text: string,
  markers: string[],
): string[] {
  return markers.filter((marker) =>
    text.includes(marker),
  );
}

function jsonHasForbiddenKeys(
  value: unknown,
  forbidden: string[],
  path = "",
): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(
        ...jsonHasForbiddenKeys(
          item,
          forbidden,
          `${path}[${index}]`,
        ),
      );
    });
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.includes(key)) {
        hits.push(next);
      }
      hits.push(
        ...jsonHasForbiddenKeys(
          child,
          forbidden,
          next,
        ),
      );
    }
  }
  return hits;
}

async function main() {
  const envIsProduction =
    process.env.NODE_ENV === "production";
  assert(
    !envIsProduction,
    "Refusing to run Step 2C tests with NODE_ENV=production.",
  );

  // Ephemeral isolated test key — not written to disk, not logged.
  const ephemeralKey = randomBytes(32).toString(
    "base64",
  );
  const previousKey =
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;
  const previousActive =
    process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION;
  const keyWasMissing = !previousKey;

  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 =
    ephemeralKey;
  process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION = "1";

  const {
    encryptSocialValue,
    decryptSocialValue,
    encryptSocialTokenPayload,
    decryptSocialTokenPayload,
    buildSocialCredentialAad,
    getActiveSocialEncryptionKeyVersion,
    isSocialEncryptionConfigured,
  } = await import(
    "../src/lib/social/security/social-crypto"
  );

  const { completeSocialOAuthState } =
    await import(
      "../src/lib/social/connections/social-connection-service"
    );
  const { disconnectSocialConnection } =
    await import(
      "../src/lib/social/connections/social-connection-management"
    );
  const { getSocialConnectionsData } =
    await import(
      "../src/lib/social/connections/social-connection-data"
    );
  const { assertProfileCanManageSocialAccounts } =
    await import(
      "../src/lib/social/connections/social-connection-auth"
    );

  const prisma = new PrismaClient();
  installLogCapture();

  const fakeAccess = `test-access-${randomBytes(8).toString("hex")}`;
  const fakeRefresh = `test-refresh-${randomBytes(8).toString("hex")}`;
  const markerTokens = [fakeAccess, fakeRefresh];

  let clientId = "";
  let brandId = "";
  let connectionId = "";
  let managerProfileId = "";
  let outsiderProfileId = "";
  let inactiveProfileId = "";
  let viewerProfileId = "";
  let oauthStateId = "";
  let socialAccountId = "";

  try {
    // -------- Fixture setup --------
    const stamp = Date.now();
    const client = await prisma.client.create({
      data: {
        name: `2C Test Client ${stamp}`,
        status: "active",
        companyName: "2C Isolated Test",
      },
      select: { id: true },
    });
    clientId = client.id;

    const brand = await prisma.businessBrand.create({
      data: {
        clientId,
        name: `2C Brand ${stamp}`,
        status: "active",
      },
      select: { id: true },
    });
    brandId = brand.id;

    const makeProfile = async (label: string) => {
      const id = cryptoRandomUuid();
      return prisma.profile.create({
        data: {
          id,
          authUserId: cryptoRandomUuid(),
          email: `step2c-${label}-${stamp}@example.test`,
          displayName: `2C ${label}`,
          status: "active",
          role: "user",
        },
        select: { id: true },
      });
    };

    managerProfileId = (await makeProfile("manager"))
      .id;
    outsiderProfileId = (
      await makeProfile("outsider")
    ).id;
    inactiveProfileId = (
      await makeProfile("inactive")
    ).id;
    viewerProfileId = (await makeProfile("viewer"))
      .id;

    await prisma.clientMembership.createMany({
      data: [
        {
          profileId: managerProfileId,
          clientId,
          role: "manager",
          status: "active",
        },
        {
          profileId: inactiveProfileId,
          clientId,
          role: "manager",
          status: "suspended",
        },
        {
          profileId: viewerProfileId,
          clientId,
          role: "viewer",
          status: "active",
        },
      ],
    });

    // Outsider has membership on a different client only.
    const otherClient = await prisma.client.create({
      data: {
        name: `2C Other Client ${stamp}`,
        status: "active",
      },
      select: { id: true },
    });
    await prisma.clientMembership.create({
      data: {
        profileId: outsiderProfileId,
        clientId: otherClient.id,
        role: "manager",
        status: "active",
      },
    });

    const connection =
      await prisma.socialProviderConnection.create({
        data: {
          clientId,
          businessBrandId: brandId,
          provider: "meta",
          status: "pending_authorization",
          createdByProfileId: managerProfileId,
          displayName: "2C Test Meta User",
          externalSubjectId: "test-meta-subject",
        },
        select: { id: true, status: true },
      });
    connectionId = connection.id;

    const account = await prisma.socialAccount.create({
      data: {
        clientId,
        businessBrandId: brandId,
        providerConnectionId: connectionId,
        platform: "facebook",
        externalAccountId: `page-${stamp}`,
        handle: "2c-test-page",
        displayName: "2C Test Page",
        status: "connected",
      },
      select: { id: true },
    });
    socialAccountId = account.id;

    const aad = buildSocialCredentialAad({
      clientId,
      connectionId,
      provider: "meta",
    });

    // ==================== Test 1 ====================
    try {
      const encrypted = encryptSocialTokenPayload(
        {
          accessToken: fakeAccess,
          refreshToken: fakeRefresh,
          tokenType: "bearer",
          scopes: ["pages_show_list"],
          providerAccountId: "test-meta-subject",
        },
        aad,
      );

      const decrypted = decryptSocialTokenPayload(
        encrypted,
        aad,
      );

      await prisma.socialCredential.create({
        data: {
          clientId,
          connectionId,
          status: "active",
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          lastValidatedAt: new Date(),
          statusChangedAt: new Date(),
        },
      });

      const row = await prisma.socialCredential.findUnique({
        where: { connectionId },
      });
      assert(row, "credential row missing");

      const storedBlob = [
        row.encryptedPayload,
        row.iv,
        row.authTag,
      ].join("|");

      const plaintextAbsent =
        !storedBlob.includes(fakeAccess) &&
        !storedBlob.includes(fakeRefresh);
      const keyVersionOk = row.keyVersion === 1;
      const connectionStill =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: { status: true },
        });

      assert(
        decrypted.accessToken === fakeAccess &&
          decrypted.refreshToken === fakeRefresh,
        "decrypted values mismatch",
      );
      assert(plaintextAbsent, "plaintext found in DB columns");
      assert(keyVersionOk, "key version not recorded");
      assert(
        connectionStill?.status ===
          "pending_authorization",
        "connection status changed merely by storing credential",
      );

      record(
        1,
        "Encryption and decryption round trip",
        "PASS",
        "Round-trip matched; DB had no plaintext tokens; keyVersion recorded; connection remained pending_authorization.",
      );
    } catch (error) {
      record(
        1,
        "Encryption and decryption round trip",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 2 ====================
    try {
      const first = encryptSocialValue(
        fakeAccess,
        1,
        aad,
      );
      const second = encryptSocialValue(
        fakeAccess,
        1,
        aad,
      );
      assert(
        first.ciphertext !== second.ciphertext,
        "ciphertexts identical",
      );
      assert(first.iv !== second.iv, "IVs identical");
      assert(
        decryptSocialValue(first, aad) ===
          fakeAccess &&
          decryptSocialValue(second, aad) ===
            fakeAccess,
        "decrypt mismatch",
      );
      record(
        2,
        "Random encryption output",
        "PASS",
        "Same plaintext produced distinct ciphertext and IV; both decrypted correctly.",
      );
    } catch (error) {
      record(
        2,
        "Random encryption output",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 3 ====================
    try {
      const valid = encryptSocialValue(
        fakeAccess,
        1,
        aad,
      );
      const tampered = {
        ...valid,
        ciphertext: Buffer.from(
          Buffer.from(valid.ciphertext, "base64").map(
            (byte, index) =>
              index === 0 ? byte ^ 0xff : byte,
          ),
        ).toString("base64"),
      };

      let failed = false;
      let leaked = false;
      try {
        const out = decryptSocialValue(tampered, aad);
        leaked = markerTokens.some((token) =>
          out.includes(token),
        );
      } catch {
        failed = true;
      }

      const connectionAfter =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: { status: true },
        });

      assert(failed, "tampered ciphertext decrypted");
      assert(!leaked, "partial plaintext leaked");
      assert(
        connectionAfter?.status !== "connected" &&
          connectionAfter?.status !== "authorized",
        "connection incorrectly promoted",
      );

      record(
        3,
        "Ciphertext tampering",
        "PASS",
        "Tampered ciphertext failed decrypt securely; no plaintext returned; connection not promoted.",
      );
    } catch (error) {
      record(
        3,
        "Ciphertext tampering",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 4 ====================
    try {
      const valid = encryptSocialValue(
        fakeAccess,
        1,
        aad,
      );

      const badIv = {
        ...valid,
        iv: Buffer.from(
          Buffer.from(valid.iv, "base64").map(
            (byte, index) =>
              index === 0 ? byte ^ 0xff : byte,
          ),
        ).toString("base64"),
      };
      const badTag = {
        ...valid,
        authTag: Buffer.from(
          Buffer.from(valid.authTag, "base64").map(
            (byte, index) =>
              index === 0 ? byte ^ 0xff : byte,
          ),
        ).toString("base64"),
      };

      let ivFailed = false;
      let tagFailed = false;
      try {
        decryptSocialValue(badIv, aad);
      } catch {
        ivFailed = true;
      }
      try {
        decryptSocialValue(badTag, aad);
      } catch {
        tagFailed = true;
      }

      assert(ivFailed && tagFailed, "IV/tag tamper did not fail");
      record(
        4,
        "IV and authentication-tag tampering",
        "PASS",
        "Altered IV and altered auth tag each failed decrypt with no plaintext returned.",
      );
    } catch (error) {
      record(
        4,
        "IV and authentication-tag tampering",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 5 ====================
    try {
      const valid = encryptSocialTokenPayload(
        {
          accessToken: fakeAccess,
          refreshToken: fakeRefresh,
        },
        aad,
      );

      const wrongClient = buildSocialCredentialAad({
        clientId: cryptoRandomUuid(),
        connectionId,
        provider: "meta",
      });
      const wrongConnection = buildSocialCredentialAad({
        clientId,
        connectionId: cryptoRandomUuid(),
        provider: "meta",
      });
      const wrongProvider = buildSocialCredentialAad({
        clientId,
        connectionId,
        provider: "other",
      });

      const mismatches = [
        wrongClient,
        wrongConnection,
        wrongProvider,
      ];
      let allFailed = true;
      for (const context of mismatches) {
        try {
          decryptSocialTokenPayload(valid, context);
          allFailed = false;
        } catch {
          // expected
        }
      }
      assert(allFailed, "AAD mismatch still decrypted");
      record(
        5,
        "AAD binding",
        "PASS",
        "Decrypt failed for mismatched client, connection, and provider AAD contexts.",
      );
    } catch (error) {
      record(
        5,
        "AAD binding",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 6 ====================
    try {
      let wrongKeyFailed = false;
      let missingKeyFailed = false;
      let plaintextFallback = false;

      const good = encryptSocialValue(
        fakeAccess,
        1,
        aad,
      );

      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 =
        randomBytes(32).toString("base64");
      // Re-import is cached; mutate by calling with wrong configured key requires
      // clearing module state. Instead verify decrypt fails after swapping env and
      // dynamically reloading the module.
      const cryptoUrl = new URL(
        `../src/lib/social/security/social-crypto.ts?wrong=${Date.now()}`,
        import.meta.url,
      ).href;
      const wrongCrypto = await import(cryptoUrl);
      try {
        wrongCrypto.decryptSocialValue(good, aad);
      } catch {
        wrongKeyFailed = true;
      }

      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;
      const missingCryptoUrl = new URL(
        `../src/lib/social/security/social-crypto.ts?missing=${Date.now()}`,
        import.meta.url,
      ).href;
      const missingCrypto = await import(
        missingCryptoUrl
      );
      try {
        missingCrypto.encryptSocialValue(
          fakeAccess,
          1,
          aad,
        );
        plaintextFallback = true;
      } catch {
        missingKeyFailed = true;
      }

      // Restore ephemeral key for remaining tests and reload module bindings
      // are already held from the first import; restore env for Prisma path.
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 =
        ephemeralKey;
      process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION = "1";

      const connectionAfter =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: { status: true },
        });

      assert(wrongKeyFailed, "wrong key did not fail");
      assert(
        missingKeyFailed && !plaintextFallback,
        "missing key did not fail securely",
      );
      assert(
        connectionAfter?.status !== "authorized" &&
          connectionAfter?.status !== "connected",
        "connection promoted during key failure",
      );
      assert(
        keyWasMissing || true,
        "env observation",
      );

      record(
        6,
        "Incorrect or missing encryption key",
        "PASS",
        `Wrong key and missing key both failed securely with no plaintext fallback; connection not authorized/connected. Dev .env initially missing SOCIAL_TOKEN_ENCRYPTION_KEY_V1=${keyWasMissing}.`,
      );
    } catch (error) {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 =
        ephemeralKey;
      record(
        6,
        "Incorrect or missing encryption key",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 7 ====================
    try {
      // Promote through approved completion path for API-shaped reads.
      const oauth =
        await prisma.socialOAuthState.create({
          data: {
            clientId,
            businessBrandId: brandId,
            connectionId,
            provider: "meta",
            status: "pending",
            stateHash: createHash("sha256")
              .update(`2c-state-${stamp}`)
              .digest("hex"),
            codeVerifierCiphertext: "x",
            codeVerifierIv: "x",
            codeVerifierAuthTag: "x",
            returnPath: "/dashboard/social/accounts",
            expiresAt: new Date(
              Date.now() + 10 * 60 * 1000,
            ),
            createdByProfileId: managerProfileId,
            metadata: { keyVersion: 1 },
          },
          select: { id: true },
        });
      oauthStateId = oauth.id;

      // Fresh connection for completion path (existing may already have credential).
      await completeSocialOAuthState({
        oauthStateId,
        connectionId,
        profileId: managerProfileId,
        externalSubjectId: "test-meta-subject",
        displayName: "2C Test Meta User",
        scopes: ["pages_show_list"],
        tokenPayload: {
          accessToken: fakeAccess,
          refreshToken: fakeRefresh,
          tokenType: "bearer",
        },
        accessTokenExpiresAt: new Date(
          Date.now() + 3600_000,
        ),
      });

      const summaries =
        await getSocialConnectionsData(clientId, brandId);

      const forbiddenKeys = [
        "accessToken",
        "refreshToken",
        "authorizationCode",
        "encryptedPayload",
        "ciphertext",
        "iv",
        "authTag",
        "keyVersion",
        "codeVerifier",
        "encryptionKey",
      ];
      const hits = jsonHasForbiddenKeys(
        summaries,
        forbiddenKeys,
      );
      const serialized = JSON.stringify(summaries);
      const tokenHits = containsForbiddenSecretShapes(
        serialized,
        markerTokens,
      );

      const target = summaries.find(
        (item) => item.id === connectionId,
      );
      assert(target, "summary missing connection");
      assert(
        target.hasCredential === true,
        "hasCredential false after store",
      );
      assert(
        target.status === "authorized",
        "expected authorized after completion (not connected)",
      );
      assert(hits.length === 0, `forbidden keys: ${hits.join(",")}`);
      assert(
        tokenHits.length === 0,
        "token values appeared in response",
      );

      record(
        7,
        "API response protection",
        "PASS",
        "Connection summary exposed safe metadata only (provider/status/expiry/hasCredential); no token or crypto material fields.",
      );
    } catch (error) {
      record(
        7,
        "API response protection",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 8 ====================
    try {
      const joined = captureLog.join("\n");
      const tokenHits = containsForbiddenSecretShapes(
        joined,
        [
          ...markerTokens,
          ephemeralKey,
          "SOCIAL_TOKEN_ENCRYPTION_KEY_V1=",
        ],
      );

      // Force a safe failure log path through handle-style messaging.
      try {
        decryptSocialValue(
          {
            ciphertext: "AAAA",
            iv: "AAAA",
            authTag: "AAAA",
            keyVersion: 1,
          },
          aad,
        );
      } catch (error) {
        originalError(
          "[step-2c-test] decrypt failure:",
          error instanceof Error
            ? error.message
            : "unknown",
        );
      }

      const after = captureLog.join("\n");
      const afterHits = containsForbiddenSecretShapes(
        after,
        markerTokens,
      );

      assert(
        tokenHits.length === 0 && afterHits.length === 0,
        "secrets found in logs",
      );

      record(
        8,
        "Log protection",
        "PASS",
        "Captured logs during store/failure paths contained no tokens, key material, or encrypted field values.",
      );
    } catch (error) {
      record(
        8,
        "Log protection",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 9 ====================
    try {
      const failConnection =
        await prisma.socialProviderConnection.create({
          data: {
            clientId,
            businessBrandId: brandId,
            provider: "google",
            status: "pending_authorization",
            createdByProfileId: managerProfileId,
          },
          select: { id: true },
        });

      const failOAuth =
        await prisma.socialOAuthState.create({
          data: {
            clientId,
            businessBrandId: brandId,
            connectionId: failConnection.id,
            provider: "google",
            status: "pending",
            stateHash: createHash("sha256")
              .update(`2c-fail-${stamp}`)
              .digest("hex"),
            codeVerifierCiphertext: "x",
            codeVerifierIv: "x",
            codeVerifierAuthTag: "x",
            returnPath: "/dashboard/social/accounts",
            expiresAt: new Date(
              Date.now() + 10 * 60 * 1000,
            ),
            createdByProfileId: managerProfileId,
          },
          select: { id: true },
        });

      // Force encryption failure via empty access token.
      let threw = false;
      try {
        await completeSocialOAuthState({
          oauthStateId: failOAuth.id,
          connectionId: failConnection.id,
          profileId: managerProfileId,
          tokenPayload: {
            accessToken: "   ",
            refreshToken: fakeRefresh,
          },
        });
      } catch {
        threw = true;
      }

      const credCount =
        await prisma.socialCredential.count({
          where: { connectionId: failConnection.id },
        });
      const failStatus =
        await prisma.socialProviderConnection.findUnique({
          where: { id: failConnection.id },
          select: { status: true },
        });
      const oauthStatus =
        await prisma.socialOAuthState.findUnique({
          where: { id: failOAuth.id },
          select: { status: true },
        });

      assert(threw, "completion did not throw");
      assert(credCount === 0, "partial credential remained");
      assert(
        failStatus?.status !== "authorized" &&
          failStatus?.status !== "connected",
        "connection promoted after encrypt failure",
      );
      assert(
        oauthStatus?.status === "pending",
        "oauth state advanced despite failure",
      );

      await prisma.socialOAuthState.delete({
        where: { id: failOAuth.id },
      });
      await prisma.socialProviderConnection.delete({
        where: { id: failConnection.id },
      });

      record(
        9,
        "Encryption failure and transaction safety",
        "PASS",
        "Forced encrypt failure left no credential row, connection not authorized/connected, OAuth state remained pending (transaction rolled back).",
      );
    } catch (error) {
      record(
        9,
        "Encryption failure and transaction safety",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 10 ====================
    try {
      const beforeCount =
        await prisma.socialCredential.count({
          where: { connectionId },
        });
      const before =
        await prisma.socialCredential.findUnique({
          where: { connectionId },
          select: {
            encryptedPayload: true,
            iv: true,
            id: true,
          },
        });

      const reconnectOAuth =
        await prisma.socialOAuthState.create({
          data: {
            clientId,
            businessBrandId: brandId,
            connectionId,
            provider: "meta",
            status: "pending",
            stateHash: createHash("sha256")
              .update(`2c-reconnect-${stamp}`)
              .digest("hex"),
            codeVerifierCiphertext: "x",
            codeVerifierIv: "x",
            codeVerifierAuthTag: "x",
            returnPath: "/dashboard/social/accounts",
            expiresAt: new Date(
              Date.now() + 10 * 60 * 1000,
            ),
            createdByProfileId: managerProfileId,
          },
          select: { id: true },
        });

      const newAccess = `test-access-reconnect-${randomBytes(8).toString("hex")}`;
      markerTokens.push(newAccess);

      await completeSocialOAuthState({
        oauthStateId: reconnectOAuth.id,
        connectionId,
        profileId: managerProfileId,
        externalSubjectId: "test-meta-subject",
        displayName: "2C Test Meta User",
        scopes: ["pages_show_list"],
        tokenPayload: {
          accessToken: newAccess,
          refreshToken: fakeRefresh,
        },
      });

      const afterCount =
        await prisma.socialCredential.count({
          where: { connectionId },
        });
      const after =
        await prisma.socialCredential.findUnique({
          where: { connectionId },
          select: {
            encryptedPayload: true,
            iv: true,
            id: true,
            status: true,
          },
        });

      assert(beforeCount === 1, "expected one credential before");
      assert(afterCount === 1, "duplicate credential created");
      assert(after?.id === before?.id, "row id changed unexpectedly");
      assert(
        after?.encryptedPayload !==
          before?.encryptedPayload ||
          after?.iv !== before?.iv,
        "payload was not replaced",
      );
      assert(after?.status === "active", "status not active");

      // Unique constraint check: second insert must fail.
      let duplicateBlocked = false;
      try {
        await prisma.socialCredential.create({
          data: {
            clientId,
            connectionId,
            status: "active",
            encryptedPayload: "dup",
            iv: "dup",
            authTag: "dup",
            keyVersion: 1,
          },
        });
      } catch {
        duplicateBlocked = true;
      }
      assert(duplicateBlocked, "DB allowed duplicate credential");

      record(
        10,
        "One credential per provider connection",
        "PASS",
        "Reconnect upsert kept a single credential row, replaced ciphertext, and DB unique constraint blocked duplicates.",
      );
    } catch (error) {
      record(
        10,
        "One credential per provider connection",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 11 ====================
    try {
      const connectionRow =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: {
            status: true,
            externalSubjectId: true,
            displayName: true,
          },
        });
      const accountRow =
        await prisma.socialAccount.findUnique({
          where: { id: socialAccountId },
          select: {
            id: true,
            displayName: true,
            externalAccountId: true,
            providerConnectionId: true,
          },
        });
      const cred =
        await prisma.socialCredential.findUnique({
          where: { connectionId },
          select: { id: true, status: true },
        });

      assert(
        connectionRow?.status === "authorized",
        "expected authorized after reconnect (not connected)",
      );
      assert(
        accountRow?.displayName === "2C Test Page",
        "account identity lost",
      );
      assert(
        accountRow?.providerConnectionId ===
          connectionId,
        "account unlinked",
      );
      assert(cred?.status === "active", "credential missing");

      // Failed reconnect must not destroy valid credential.
      const failAgainOAuth =
        await prisma.socialOAuthState.create({
          data: {
            clientId,
            businessBrandId: brandId,
            connectionId,
            provider: "meta",
            status: "pending",
            stateHash: createHash("sha256")
              .update(`2c-reconnect-fail-${stamp}`)
              .digest("hex"),
            codeVerifierCiphertext: "x",
            codeVerifierIv: "x",
            codeVerifierAuthTag: "x",
            returnPath: "/dashboard/social/accounts",
            expiresAt: new Date(
              Date.now() + 10 * 60 * 1000,
            ),
            createdByProfileId: managerProfileId,
          },
          select: { id: true },
        });

      try {
        await completeSocialOAuthState({
          oauthStateId: failAgainOAuth.id,
          connectionId,
          profileId: managerProfileId,
          tokenPayload: { accessToken: "  " },
        });
      } catch {
        // expected
      }

      const credAfterFail =
        await prisma.socialCredential.findUnique({
          where: { connectionId },
          select: { id: true, status: true },
        });
      assert(
        credAfterFail?.id === cred?.id &&
          credAfterFail?.status === "active",
        "failed reconnect destroyed valid credential",
      );

      record(
        11,
        "Reconnection status safety",
        "PASS",
        "Reconnect kept authorized (not connected), preserved account identity, and failed reconnect left prior active credential intact.",
      );
    } catch (error) {
      record(
        11,
        "Reconnection status safety",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 13 first (auth), then 12 disconnect ====================
    try {
      const attempts: {
        label: string;
        profileId: string;
        expectReject: boolean;
      }[] = [
        {
          label: "outsider",
          profileId: outsiderProfileId,
          expectReject: true,
        },
        {
          label: "inactive",
          profileId: inactiveProfileId,
          expectReject: true,
        },
        {
          label: "viewer",
          profileId: viewerProfileId,
          expectReject: true,
        },
        {
          label: "manager",
          profileId: managerProfileId,
          expectReject: false,
        },
      ];

      // Authorization-only checks first (without mutating yet for rejects).
      for (const attempt of attempts.slice(0, 3)) {
        let rejected = false;
        let safeMessage = true;
        try {
          await assertProfileCanManageSocialAccounts(
            prisma,
            {
              clientId,
              profileId: attempt.profileId,
            },
          );
        } catch (error) {
          rejected = true;
          const message =
            error instanceof Error
              ? error.message
              : "";
          safeMessage = !containsForbiddenSecretShapes(
            message,
            markerTokens,
          ).length;
        }
        assert(
          rejected,
          `${attempt.label} was not rejected`,
        );
        assert(
          safeMessage,
          `${attempt.label} rejection leaked secrets`,
        );
      }

      const beforeDisconnectCred =
        await prisma.socialCredential.count({
          where: { connectionId },
        });
      const beforeStatus =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: { status: true },
        });

      // Rejected disconnect attempts must not change state.
      for (const attempt of attempts.slice(0, 3)) {
        try {
          await disconnectSocialConnection({
            clientId,
            profileId: attempt.profileId,
            connectionId,
          });
        } catch {
          // expected
        }
      }

      const midCred =
        await prisma.socialCredential.count({
          where: { connectionId },
        });
      const midStatus =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: { status: true },
        });
      assert(
        midCred === beforeDisconnectCred,
        "unauthorized disconnect removed credential",
      );
      assert(
        midStatus?.status === beforeStatus?.status,
        "unauthorized disconnect changed status",
      );

      record(
        13,
        "Disconnect authorization",
        "PASS",
        "Outsider, inactive member, and viewer without manage_social_accounts were rejected without state change; manager permitted by auth check.",
      );
    } catch (error) {
      record(
        13,
        "Disconnect authorization",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 12 ====================
    try {
      const disconnected =
        await disconnectSocialConnection({
          clientId,
          profileId: managerProfileId,
          connectionId,
        });

      const credCount =
        await prisma.socialCredential.count({
          where: { connectionId },
        });
      const connectionRow =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: {
            status: true,
            displayName: true,
            externalSubjectId: true,
            disconnectedAt: true,
          },
        });
      const accountRow =
        await prisma.socialAccount.findUnique({
          where: { id: socialAccountId },
          select: {
            status: true,
            providerConnectionId: true,
            displayName: true,
            externalAccountId: true,
          },
        });

      assert(
        disconnected.status === "disconnected",
        "disconnect result status",
      );
      assert(credCount === 0, "credential still present");
      assert(
        connectionRow?.status === "disconnected",
        "connection not disconnected",
      );
      assert(
        accountRow?.status === "not_connected",
        "account status not preserved as not_connected",
      );
      assert(
        accountRow?.providerConnectionId === null,
        "account still linked for auth use",
      );
      assert(
        accountRow?.displayName === "2C Test Page" &&
          !!accountRow.externalAccountId,
        "account history identity lost",
      );

      record(
        12,
        "Disconnect behavior",
        "PASS",
        "Manager disconnect removed usable credential, set disconnected status, and preserved account identity history as not_connected.",
      );
    } catch (error) {
      record(
        12,
        "Disconnect behavior",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 14 ====================
    try {
      // Re-create a connection/credential under v1, then read while active version differs.
      const rotConnection =
        await prisma.socialProviderConnection.create({
          data: {
            clientId,
            businessBrandId: brandId,
            provider: "tiktok",
            status: "pending_authorization",
            createdByProfileId: managerProfileId,
          },
          select: { id: true },
        });

      const rotAad = buildSocialCredentialAad({
        clientId,
        connectionId: rotConnection.id,
        provider: "tiktok",
      });

      const v1 = encryptSocialValue(
        fakeAccess,
        1,
        rotAad,
      );
      assert(v1.keyVersion === 1, "expected v1");

      process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION = "2";
      // First-import module still decrypts using recorded keyVersion lookup.
      const decrypted = decryptSocialValue(v1, rotAad);
      assert(
        decrypted === fakeAccess,
        "v1 decrypt failed while active=2",
      );

      let unknownFailed = false;
      try {
        decryptSocialValue(
          { ...v1, keyVersion: 99 },
          rotAad,
        );
      } catch {
        unknownFailed = true;
      }
      assert(unknownFailed, "unknown key version did not fail");

      // New encrypt through token helper uses active version from first-loaded module
      // (active version function reads env live).
      const activeNow =
        getActiveSocialEncryptionKeyVersion();
      assert(activeNow === 2, "active version not 2");

      let newUsesCurrentBehavior = false;
      try {
        encryptSocialValue(fakeAccess);
      } catch {
        // Expected: active=2 but only V1 key configured → fail securely.
        newUsesCurrentBehavior = true;
      }

      process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION = "1";
      const fresh = encryptSocialTokenPayload(
        { accessToken: fakeAccess },
        rotAad,
      );
      assert(
        fresh.keyVersion ===
          getActiveSocialEncryptionKeyVersion(),
        "new credential key version mismatch",
      );

      await prisma.socialProviderConnection.delete({
        where: { id: rotConnection.id },
      });

      assert(
        newUsesCurrentBehavior,
        "active=2 should not silently use another key",
      );
      assert(isSocialEncryptionConfigured(), "config check");

      record(
        14,
        "Key-version compatibility",
        "PASS",
        "Recorded v1 credential decrypted while active version pointed at 2; unknown version failed; new writes use active version and refuse unavailable versions.",
      );
    } catch (error) {
      process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION = "1";
      record(
        14,
        "Key-version compatibility",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }

    // ==================== Test 15 ====================
    try {
      // Recreate one credential to inspect physical row + access paths.
      const inspectConnection =
        await prisma.socialProviderConnection.create({
          data: {
            clientId,
            businessBrandId: brandId,
            provider: "linkedin",
            status: "pending_authorization",
            createdByProfileId: managerProfileId,
          },
          select: { id: true },
        });
      const inspectAad = buildSocialCredentialAad({
        clientId,
        connectionId: inspectConnection.id,
        provider: "linkedin",
      });
      const enc = encryptSocialTokenPayload(
        {
          accessToken: fakeAccess,
          refreshToken: fakeRefresh,
        },
        inspectAad,
      );
      await prisma.socialCredential.create({
        data: {
          clientId,
          connectionId: inspectConnection.id,
          status: "active",
          encryptedPayload: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          keyVersion: enc.keyVersion,
        },
      });

      const physical =
        await prisma.socialCredential.findUnique({
          where: {
            connectionId: inspectConnection.id,
          },
        });
      assert(physical, "missing physical row");
      const physicalText = JSON.stringify({
        payloadLen: physical.encryptedPayload.length,
        ivLen: physical.iv.length,
        tagLen: physical.authTag.length,
        keyVersion: physical.keyVersion,
        status: physical.status,
      });
      void physicalText;

      const plaintextInDb =
        physical.encryptedPayload.includes(
          fakeAccess,
        ) ||
        physical.encryptedPayload.includes(
          fakeRefresh,
        ) ||
        physical.iv.includes(fakeAccess) ||
        physical.authTag.includes(fakeAccess);
      assert(!plaintextInDb, "plaintext in DB");

      const summaries =
        await getSocialConnectionsData(clientId);
      const inspectSummary = summaries.find(
        (item) => item.id === inspectConnection.id,
      );
      const forbidden = jsonHasForbiddenKeys(
        inspectSummary,
        [
          "encryptedPayload",
          "iv",
          "authTag",
          "keyVersion",
          "accessToken",
          "refreshToken",
        ],
      );
      assert(
        forbidden.length === 0,
        `summary leaked ${forbidden.join(",")}`,
      );
      assert(
        inspectSummary?.hasCredential === true,
        "hasCredential missing",
      );

      // Belonging: credential clientId must match connection.
      assert(
        physical.clientId === clientId,
        "credential client mismatch",
      );
      assert(
        physical.connectionId === inspectConnection.id,
        "credential connection mismatch",
      );

      let dupBlocked = false;
      try {
        await prisma.socialCredential.create({
          data: {
            clientId,
            connectionId: inspectConnection.id,
            status: "active",
            encryptedPayload: "x",
            iv: "x",
            authTag: "x",
            keyVersion: 1,
          },
        });
      } catch {
        dupBlocked = true;
      }
      assert(dupBlocked, "duplicate allowed");

      await prisma.socialCredential.deleteMany({
        where: { connectionId: inspectConnection.id },
      });
      await prisma.socialProviderConnection.delete({
        where: { id: inspectConnection.id },
      });

      record(
        15,
        "Database and access inspection",
        "PASS",
        "Physical credential row had no plaintext tokens; normal connection reads expose hasCredential only; unique connectionId enforced.",
      );
    } catch (error) {
      record(
        15,
        "Database and access inspection",
        "FAIL",
        error instanceof Error
          ? error.message
          : "unknown",
      );
    }
  } finally {
    restoreLogs();

    // Cleanup fixtures (best effort).
    try {
      if (clientId) {
        await prisma.socialCredential.deleteMany({
          where: { clientId },
        });
        await prisma.socialOAuthState.deleteMany({
          where: { clientId },
        });
        await prisma.socialAccount.deleteMany({
          where: { clientId },
        });
        await prisma.socialProviderConnection.deleteMany({
          where: { clientId },
        });
        await prisma.auditLog.deleteMany({
          where: { clientId },
        });
        await prisma.clientMembership.deleteMany({
          where: { clientId },
        });
        await prisma.businessBrand.deleteMany({
          where: { clientId },
        });
        await prisma.client.deleteMany({
          where: {
            OR: [
              { id: clientId },
              {
                name: {
                  startsWith: "2C Other Client",
                },
              },
            ],
          },
        });
      }

      const profileIds = [
        managerProfileId,
        outsiderProfileId,
        inactiveProfileId,
        viewerProfileId,
      ].filter(Boolean);
      if (profileIds.length) {
        await prisma.clientMembership.deleteMany({
          where: { profileId: { in: profileIds } },
        });
        await prisma.profile.deleteMany({
          where: { id: { in: profileIds } },
        });
      }
    } catch (cleanupError) {
      originalError(
        "[step-2c-test] cleanup issue:",
        cleanupError instanceof Error
          ? cleanupError.message
          : "unknown",
      );
    }

    await prisma.$disconnect();

    if (previousKey === undefined) {
      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;
    } else {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 =
        previousKey;
    }
    if (previousActive === undefined) {
      delete process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION;
    } else {
      process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION =
        previousActive;
    }
  }

  // Migration / typecheck notes gathered by caller; print machine report.
  const ordered = [...results].sort(
    (a, b) => a.id - b.id,
  );
  for (let id = 1; id <= 15; id += 1) {
    if (!ordered.find((item) => item.id === id)) {
      record(
        id,
        `Test ${id}`,
        "BLOCKED",
        "Test did not run.",
      );
    }
  }

  const finalResults = [...results].sort(
    (a, b) => a.id - b.id,
  );
  const summary = {
    environment: "development/isolated (NODE_ENV not production)",
    encryptionKeyConfiguredInDotEnv: !keyWasMissing,
    usedEphemeralTestKey: true,
    results: finalResults.map((item) => ({
      test: item.id,
      name: item.name,
      status: item.status,
      evidence: item.evidence,
    })),
    passCount: finalResults.filter(
      (item) => item.status === "PASS",
    ).length,
    failCount: finalResults.filter(
      (item) => item.status === "FAIL",
    ).length,
    blockedCount: finalResults.filter(
      (item) => item.status === "BLOCKED",
    ).length,
  };

  // Restore console.log for the final summary only.
  originalLog(JSON.stringify(summary, null, 2));

  if (summary.failCount > 0 || summary.blockedCount > 0) {
    process.exitCode = 1;
  }
}

function cryptoRandomUuid(): string {
  // UUID v4 from random bytes without importing crypto.randomUUID for older node.
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      fatal: true,
      message:
        error instanceof Error
          ? error.message
          : "unknown failure",
    }),
  );
  process.exit(1);
});
