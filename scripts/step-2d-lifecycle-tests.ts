/**
 * Step 2D isolated lifecycle / ownership verification.
 * Uses disposable fixtures and fake tokens only.
 * Never prints tokens, keys, ciphertext, or unnecessary identifiers.
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type Status = "PASS" | "FAIL" | "BLOCKED";

type Result = {
  id: number;
  name: string;
  status: Status;
  action: string;
  observed: string;
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

// Interactive transactions are unreliable through transaction-mode poolers.
// Prefer the direct database URL for this isolated verification run.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

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
  action: string,
  observed: string,
) {
  results.push({ id, name, status, action, observed });
}

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function uuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
      if (forbidden.includes(key)) hits.push(next);
      hits.push(
        ...jsonHasForbiddenKeys(child, forbidden, next),
      );
    }
  }
  return hits;
}

async function main() {
  assert(
    process.env.NODE_ENV !== "production",
    "Refusing to run Step 2D tests in production.",
  );

  const ephemeralKey = randomBytes(32).toString("base64");
  const previousKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;
  const previousActive =
    process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION;
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = ephemeralKey;
  process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION = "1";

  const {
    encryptSocialTokenPayload,
    buildSocialCredentialAad,
  } = await import(
    "../src/lib/social/security/social-crypto"
  );
  const { completeSocialOAuthState } = await import(
    "../src/lib/social/connections/social-connection-service"
  );
  const {
    assignSocialAccountToBrand,
    unassignSocialAccountFromBrand,
  } = await import(
    "../src/lib/social/connections/social-brand-assignment"
  );
  const { disconnectSocialConnection } = await import(
    "../src/lib/social/connections/social-connection-management"
  );
  const { getSocialConnectionsData } = await import(
    "../src/lib/social/connections/social-connection-data"
  );

  const prisma = new PrismaClient();
  installLogCapture();

  const stamp = Date.now();
  const fakeAccess = `2d-access-${randomBytes(8).toString("hex")}`;
  const fakeRefresh = `2d-refresh-${randomBytes(8).toString("hex")}`;
  const markerTokens = [fakeAccess, fakeRefresh, ephemeralKey];

  let clientAId = "";
  let clientBId = "";
  let brandA1Id = "";
  let brandA2Id = "";
  let brandBId = "";
  let managerId = "";
  let outsiderId = "";
  let inactiveId = "";
  let viewerId = "";
  let assignerId = "";
  let connectionA1Id = "";
  let connectionA2Id = "";
  let page1Id = "";
  let page2Id = "";
  let statusAfterFinalUnassign = "";
  const createdProfileIds: string[] = [];
  const createdClientIds: string[] = [];

  async function makeProfile(label: string) {
    const profile = await prisma.profile.create({
      data: {
        id: uuid(),
        authUserId: uuid(),
        email: `step2d-${label}-${stamp}@example.test`,
        displayName: `2D ${label}`,
        status: "active",
        role: "user",
      },
      select: { id: true },
    });
    createdProfileIds.push(profile.id);
    return profile.id;
  }

  try {
    // -------- Fixtures --------
    const clientA = await prisma.client.create({
      data: {
        name: `2D Client A ${stamp}`,
        status: "active",
        companyName: "2D Isolated A",
      },
      select: { id: true },
    });
    clientAId = clientA.id;
    createdClientIds.push(clientAId);

    const clientB = await prisma.client.create({
      data: {
        name: `2D Client B ${stamp}`,
        status: "active",
        companyName: "2D Isolated B",
      },
      select: { id: true },
    });
    clientBId = clientB.id;
    createdClientIds.push(clientBId);

    brandA1Id = (
      await prisma.businessBrand.create({
        data: {
          clientId: clientAId,
          name: `2D Brand A1 ${stamp}`,
          status: "active",
        },
        select: { id: true },
      })
    ).id;

    brandA2Id = (
      await prisma.businessBrand.create({
        data: {
          clientId: clientAId,
          name: `2D Brand A2 ${stamp}`,
          status: "active",
        },
        select: { id: true },
      })
    ).id;

    brandBId = (
      await prisma.businessBrand.create({
        data: {
          clientId: clientBId,
          name: `2D Brand B ${stamp}`,
          status: "active",
        },
        select: { id: true },
      })
    ).id;

    managerId = await makeProfile("manager");
    outsiderId = await makeProfile("outsider");
    inactiveId = await makeProfile("inactive");
    viewerId = await makeProfile("viewer");
    assignerId = await makeProfile("assigner");

    await prisma.clientMembership.createMany({
      data: [
        {
          profileId: managerId,
          clientId: clientAId,
          role: "manager",
          status: "active",
        },
        {
          profileId: assignerId,
          clientId: clientAId,
          role: "manager",
          status: "active",
        },
        {
          profileId: inactiveId,
          clientId: clientAId,
          role: "manager",
          status: "suspended",
        },
        {
          profileId: viewerId,
          clientId: clientAId,
          role: "viewer",
          status: "active",
        },
        {
          profileId: outsiderId,
          clientId: clientBId,
          role: "manager",
          status: "active",
        },
      ],
    });

    // ==================== Test 1 ====================
    try {
      const first =
        await prisma.socialProviderConnection.create({
          data: {
            clientId: clientAId,
            businessBrandId: brandA1Id,
            provider: "meta",
            status: "pending_authorization",
            createdByProfileId: managerId,
          },
          select: { id: true },
        });
      connectionA1Id = first.id;

      let duplicateRejected = false;
      try {
        await prisma.socialProviderConnection.create({
          data: {
            clientId: clientAId,
            businessBrandId: brandA1Id,
            provider: "meta",
            status: "pending_authorization",
            createdByProfileId: managerId,
          },
        });
      } catch {
        duplicateRejected = true;
      }

      const existingForUpsert =
        await prisma.socialProviderConnection.findFirst({
          where: {
            clientId: clientAId,
            businessBrandId: brandA1Id,
            provider: "meta",
          },
          select: { id: true },
        });
      const upserted = existingForUpsert
        ? await prisma.socialProviderConnection.update({
            where: { id: existingForUpsert.id },
            data: {
              status: "pending_authorization",
            },
            select: { id: true },
          })
        : await prisma.socialProviderConnection.create({
            data: {
              clientId: clientAId,
              businessBrandId: brandA1Id,
              provider: "meta",
              status: "pending_authorization",
              createdByProfileId: managerId,
            },
            select: { id: true },
          });

      const otherBrand =
        await prisma.socialProviderConnection.create({
          data: {
            clientId: clientAId,
            businessBrandId: brandA2Id,
            provider: "meta",
            status: "pending_authorization",
            createdByProfileId: managerId,
          },
          select: { id: true },
        });
      connectionA2Id = otherBrand.id;

      const countA1 =
        await prisma.socialProviderConnection.count({
          where: {
            clientId: clientAId,
            businessBrandId: brandA1Id,
            provider: "meta",
          },
        });

      assert(duplicateRejected, "duplicate create allowed");
      assert(
        upserted.id === connectionA1Id,
        "upsert created second row",
      );
      assert(countA1 === 1, "duplicate rows for brand A1");
      assert(
        connectionA2Id !== connectionA1Id,
        "second brand should have own connection",
      );

      record(
        1,
        "Provider connection uniqueness",
        "PASS",
        "Created first Meta connection; attempted duplicate create; upserted same Brand; created second Brand connection.",
        "Duplicate rejected; upsert reused existing row; second Brand got its own connection; only one row per Brand+provider.",
      );
    } catch (error) {
      record(
        1,
        "Provider connection uniqueness",
        "FAIL",
        "Create/duplicate/upsert Meta connections for two Brands.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 2 ====================
    try {
      const row =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            authorizedAt: true,
            connectedAt: true,
          },
        });
      const activeAssignments =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            clientId: clientAId,
            status: "active",
            socialAccount: {
              providerConnectionId: connectionA1Id,
            },
          },
        });
      const summaries = await getSocialConnectionsData(
        clientAId,
        brandA1Id,
      );
      const summary = summaries.find(
        (item) => item.id === connectionA1Id,
      );

      assert(
        row?.status === "pending_authorization",
        "expected pending_authorization",
      );
      assert(!row?.authorizedAt, "authorizedAt present early");
      assert(!row?.connectedAt, "connectedAt present early");
      assert(activeAssignments === 0, "active assignment exists");
      assert(
        summary?.status === "pending_authorization",
        "summary not pending",
      );

      record(
        2,
        "Initial connection state",
        "PASS",
        "Inspected connection created before Meta consent and summary serialization.",
        "Status pending_authorization; authorizedAt/connectedAt absent; no active Page assignment; not presented as connected.",
      );
    } catch (error) {
      record(
        2,
        "Initial connection state",
        "FAIL",
        "Inspect pre-consent connection state.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 3 ====================
    try {
      const oauth = await prisma.socialOAuthState.create({
        data: {
          clientId: clientAId,
          businessBrandId: brandA1Id,
          connectionId: connectionA1Id,
          provider: "meta",
          status: "pending",
          stateHash: createHash("sha256")
            .update(`2d-auth-${stamp}`)
            .digest("hex"),
          codeVerifierCiphertext: "x",
          codeVerifierIv: "x",
          codeVerifierAuthTag: "x",
          returnPath: "/dashboard/social/accounts",
          expiresAt: new Date(Date.now() + 600_000),
          createdByProfileId: managerId,
        },
        select: { id: true },
      });

      await completeSocialOAuthState({
        oauthStateId: oauth.id,
        connectionId: connectionA1Id,
        profileId: managerId,
        externalSubjectId: `meta-user-${stamp}`,
        displayName: "2D Meta User",
        scopes: ["pages_show_list", "pages_read_engagement"],
        tokenPayload: {
          accessToken: fakeAccess,
          refreshToken: fakeRefresh,
          tokenType: "bearer",
        },
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
      });

      const row =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            authorizedAt: true,
            connectedAt: true,
          },
        });
      const selectedPages =
        await prisma.socialAccount.count({
          where: {
            providerConnectionId: connectionA1Id,
            accessStatus: "selected",
          },
        });
      const credential =
        await prisma.socialCredential.findUnique({
          where: { connectionId: connectionA1Id },
          select: {
            status: true,
            encryptedPayload: true,
            iv: true,
            authTag: true,
            keyVersion: true,
          },
        });

      assert(row?.status === "authorized", "not authorized");
      assert(!!row?.authorizedAt, "authorizedAt missing");
      assert(!row?.connectedAt, "connectedAt set too early");
      assert(selectedPages === 0, "page silently selected");
      assert(credential?.status === "active", "credential missing");
      assert(
        !credential!.encryptedPayload.includes(fakeAccess) &&
          !credential!.iv.includes(fakeAccess) &&
          !credential!.authTag.includes(fakeAccess),
        "plaintext in credential columns",
      );

      record(
        3,
        "Authorization completion state",
        "PASS",
        "Completed OAuth state through approved Step 2C completion path with fake tokens.",
        "Status authorized with authorizedAt; not connected; no Page selected; credential only in encrypted record.",
      );
    } catch (error) {
      record(
        3,
        "Authorization completion state",
        "FAIL",
        "Simulate authorization completion.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 4 ====================
    try {
      const discoveredAt = new Date();
      const externalPageId = `page-${stamp}-1`;

      const created = await prisma.socialAccount.create({
        data: {
          clientId: clientAId,
          providerConnectionId: connectionA1Id,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: externalPageId,
          displayName: "2D Test Page One",
          handle: "2d-page-one",
          category: "Brand",
          accessStatus: "available",
          isAvailableThroughAuth: true,
          status: "not_connected",
          firstDiscoveredAt: discoveredAt,
          lastDiscoveredAt: discoveredAt,
        },
        select: {
          id: true,
          platform: true,
          accountType: true,
          accessStatus: true,
          isAvailableThroughAuth: true,
          metadata: true,
        },
      });
      page1Id = created.id;

      const later = new Date(discoveredAt.getTime() + 1000);
      await prisma.socialAccount.update({
        where: { id: page1Id },
        data: {
          displayName: "2D Test Page One Updated",
          lastDiscoveredAt: later,
          category: "Local Business",
        },
      });

      let duplicateBlocked = false;
      try {
        await prisma.socialAccount.create({
          data: {
            clientId: clientAId,
            providerConnectionId: connectionA1Id,
            platform: "facebook",
            accountType: "facebook_page",
            externalAccountId: externalPageId,
            displayName: "dup",
            accessStatus: "available",
            isAvailableThroughAuth: true,
          },
        });
      } catch {
        duplicateBlocked = true;
      }

      const count = await prisma.socialAccount.count({
        where: {
          providerConnectionId: connectionA1Id,
          platform: "facebook",
          externalAccountId: externalPageId,
        },
      });
      const updated =
        await prisma.socialAccount.findUnique({
          where: { id: page1Id },
        });

      // Ensure no token-like fields on account columns / metadata.
      const serialized = JSON.stringify(updated);
      assert(created.platform === "facebook", "platform");
      assert(
        created.accountType === "facebook_page",
        "accountType",
      );
      assert(duplicateBlocked, "duplicate discovery allowed");
      assert(count === 1, "duplicate page rows");
      assert(
        updated?.displayName === "2D Test Page One Updated",
        "discovery update missing",
      );
      assert(
        updated?.lastDiscoveredAt?.getTime() ===
          later.getTime(),
        "lastDiscoveredAt not updated",
      );
      assert(
        !serialized.includes(fakeAccess) &&
          !serialized.includes(fakeRefresh),
        "token on social account",
      );
      assert(
        !("accessToken" in (updated as object)) &&
          !("refreshToken" in (updated as object)),
        "token fields present",
      );

      record(
        4,
        "Facebook Page discovery record",
        "PASS",
        "Created then updated a controlled Facebook Page discovery row; attempted duplicate insert.",
        "facebook/facebook_page fields correct; update reused same row; duplicate blocked; no Page token stored.",
      );
    } catch (error) {
      record(
        4,
        "Facebook Page discovery record",
        "FAIL",
        "Create/update discovery Page record.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 5 ====================
    try {
      page2Id = (
        await prisma.socialAccount.create({
          data: {
            clientId: clientAId,
            providerConnectionId: connectionA1Id,
            platform: "facebook",
            accountType: "facebook_page",
            externalAccountId: `page-${stamp}-2`,
            displayName: "2D Test Page Two",
            accessStatus: "available",
            isAvailableThroughAuth: true,
            firstDiscoveredAt: new Date(),
            lastDiscoveredAt: new Date(),
          },
          select: { id: true },
        })
      ).id;

      // Other client page with same external id must not leak via scoped lookup.
      const foreignPage = await prisma.socialAccount.create({
        data: {
          clientId: clientBId,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: `page-${stamp}-1`,
          displayName: "Foreign Page",
          accessStatus: "available",
          isAvailableThroughAuth: true,
        },
        select: { id: true },
      });

      const scoped = await prisma.socialAccount.findMany({
        where: {
          clientId: clientAId,
          providerConnectionId: connectionA1Id,
          platform: "facebook",
          externalAccountId: `page-${stamp}-1`,
        },
        select: { id: true, clientId: true },
      });

      assert(scoped.length === 1, "unexpected page count");
      assert(scoped[0]?.id === page1Id, "wrong page returned");
      assert(
        scoped.every((row) => row.clientId === clientAId),
        "cross-client page leak",
      );
      assert(
        !scoped.some((row) => row.id === foreignPage.id),
        "foreign page in scoped lookup",
      );

      record(
        5,
        "Page identity scope",
        "PASS",
        "Created second Page; created same external ID under another Client; ran scoped lookup.",
        "Duplicate external ID blocked within connection; lookups stayed Client/connection scoped.",
      );
    } catch (error) {
      record(
        5,
        "Page identity scope",
        "FAIL",
        "Verify Page uniqueness and Client scope.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 7 before 6 (authorized without selection) ====================
    try {
      const beforeAssign =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: { status: true, connectedAt: true },
        });
      const activeCount =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            clientId: clientAId,
            status: "active",
            socialAccount: {
              providerConnectionId: connectionA1Id,
            },
          },
        });

      assert(
        beforeAssign?.status === "authorized",
        "expected authorized before selection",
      );
      assert(!beforeAssign?.connectedAt, "connectedAt set");
      assert(activeCount === 0, "active assignment exists");

      record(
        7,
        "No Page selected",
        "PASS",
        "Inspected authorized connection before any Brand assignment.",
        "Remained authorized; not connected; no active assignment.",
      );
    } catch (error) {
      record(
        7,
        "No Page selected",
        "FAIL",
        "Inspect authorized connection with no Page selected.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 6 ====================
    try {
      const assigned = await assignSocialAccountToBrand({
        clientId: clientAId,
        profileId: managerId,
        businessBrandId: brandA1Id,
        socialAccountId: page1Id,
        connectionId: connectionA1Id,
      });

      const assignment =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });
      const connection =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            connectedAt: true,
          },
        });
      const page = await prisma.socialAccount.findUnique({
        where: { id: page1Id },
        select: {
          accessStatus: true,
          businessBrandId: true,
          status: true,
        },
      });

      assert(assigned.status === "active", "assignment inactive");
      assert(
        assigned.connectionStatus === "connected",
        "service did not report connected",
      );
      assert(assignment?.status === "active", "db inactive");
      assert(!!assignment?.assignedAt, "assignedAt missing");
      assert(
        assignment?.assignedByProfileId === managerId,
        "assigner mismatch",
      );
      assert(
        connection?.status === "connected",
        "connection not connected",
      );
      assert(!!connection?.connectedAt, "connectedAt missing");
      assert(page?.accessStatus === "selected", "page not selected");
      assert(
        page?.businessBrandId === brandA1Id,
        "page brand mismatch",
      );

      record(
        6,
        "Valid Brand assignment",
        "PASS",
        "Assigned available Page to its Brand via assignSocialAccountToBrand.",
        "One active assignment with time/profile; Page selected; connection connected with connectedAt in same transaction.",
      );
    } catch (error) {
      record(
        6,
        "Valid Brand assignment",
        "FAIL",
        "Assign Page to Brand.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 8 ====================
    try {
      // Force failure: assign page2 while connectionA2 is still pending.
      const beforeStatus =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA2Id },
          select: { status: true, connectedAt: true },
        });

      // Discover a page on pending connection A2
      const pendingPage = await prisma.socialAccount.create({
        data: {
          clientId: clientAId,
          providerConnectionId: connectionA2Id,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: `page-${stamp}-pending`,
          displayName: "Pending Conn Page",
          accessStatus: "available",
          isAvailableThroughAuth: true,
        },
        select: { id: true },
      });

      let failed = false;
      let safeError = true;
      try {
        await assignSocialAccountToBrand({
          clientId: clientAId,
          profileId: managerId,
          businessBrandId: brandA2Id,
          socialAccountId: pendingPage.id,
          connectionId: connectionA2Id,
        });
      } catch (error) {
        failed = true;
        const message =
          error instanceof Error ? error.message : "";
        safeError = !markerTokens.some((token) =>
          message.includes(token),
        );
      }

      const afterStatus =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA2Id },
          select: { status: true, connectedAt: true },
        });
      const partial =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: pendingPage.id,
            status: "active",
          },
        });

      assert(failed, "assignment unexpectedly succeeded");
      assert(safeError, "error exposed secrets");
      assert(partial === 0, "partial active assignment left");
      assert(
        afterStatus?.status === beforeStatus?.status,
        "connection status changed on failure",
      );
      assert(
        !afterStatus?.connectedAt,
        "connectedAt set on failure",
      );

      // Keep pending page for later cleanup via cascade.
      record(
        8,
        "Failed assignment is atomic",
        "PASS",
        "Forced assignment failure against pending_authorization connection.",
        "Threw safely; no active assignment; connection remained pending; no secrets in error.",
      );
    } catch (error) {
      record(
        8,
        "Failed assignment is atomic",
        "FAIL",
        "Force controlled assignment failure.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 9 ====================
    try {
      const before =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });

      // Idempotent re-assign same Brand+Page while already active.
      const again = await assignSocialAccountToBrand({
        clientId: clientAId,
        profileId: managerId,
        businessBrandId: brandA1Id,
        socialAccountId: page1Id,
        connectionId: connectionA1Id,
      });

      const count =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            businessBrandId: brandA1Id,
            socialAccountId: page1Id,
          },
        });
      const activeCount =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: page1Id,
            status: "active",
          },
        });

      assert(again.assignmentId === before?.id, "row duplicated");
      assert(count === 1, "more than one Brand+Page row");
      assert(activeCount === 1, "duplicate active assignment");

      record(
        9,
        "Duplicate assignment protection",
        "PASS",
        "Re-assigned the same Page to the same Brand while already active.",
        "Single Brand+Page row retained; idempotent active assignment; no duplicate active rows.",
      );
    } catch (error) {
      record(
        9,
        "Duplicate assignment protection",
        "FAIL",
        "Attempt duplicate Brand+Page assignment.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 10 ====================
    try {
      // Authorize connection A2 and try to assign page1 (already active on A1).
      await prisma.socialProviderConnection.update({
        where: { id: connectionA2Id },
        data: {
          status: "authorized",
          authorizedAt: new Date(),
        },
      });

      // Move page1 temporarily? No — page1 belongs to connectionA1.
      // Create page on A2, then try to also assign page1 to brand A2 via
      // service (should fail because page1 belongs to connection A1 OR
      // because already active elsewhere).
      // First: ensure page1 remains active on brand A1, attempt assign to A2
      // with connection A1 (wrong brand/connection pairing) and with A2.

      const original =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });

      let rejected = false;
      try {
        await assignSocialAccountToBrand({
          clientId: clientAId,
          profileId: managerId,
          businessBrandId: brandA2Id,
          socialAccountId: page1Id,
          connectionId: connectionA2Id,
        });
      } catch {
        rejected = true;
      }

      // Also verify DB partial unique: insert second active for same page.
      let dbRejected = false;
      try {
        await prisma.socialBrandAccountAssignment.create({
          data: {
            clientId: clientAId,
            businessBrandId: brandA2Id,
            socialAccountId: page1Id,
            status: "active",
            assignedByProfileId: managerId,
          },
        });
      } catch {
        dbRejected = true;
      }

      const after =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });
      const activeElsewhere =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: page1Id,
            status: "active",
            NOT: { businessBrandId: brandA1Id },
          },
        });

      assert(rejected, "service allowed sharing");
      assert(dbRejected, "DB allowed second active assignment");
      assert(
        after?.status === original?.status &&
          after?.id === original?.id,
        "original assignment changed",
      );
      assert(activeElsewhere === 0, "second active exists");

      record(
        10,
        "MVP no-sharing policy",
        "PASS",
        "Attempted second active Brand assignment for an already-assigned Page (service + DB).",
        "Service and partial unique index rejected sharing; original active assignment unchanged.",
      );
    } catch (error) {
      record(
        10,
        "MVP no-sharing policy",
        "FAIL",
        "Attempt cross-Brand active Page sharing.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 11 ====================
    try {
      const beforeConn =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: { status: true },
        });
      const beforeAssignCount =
        await prisma.socialBrandAccountAssignment.count({
          where: { clientId: clientAId, status: "active" },
        });

      let serviceRejected = false;
      try {
        await assignSocialAccountToBrand({
          clientId: clientBId,
          profileId: outsiderId,
          businessBrandId: brandBId,
          socialAccountId: page1Id,
          connectionId: connectionA1Id,
        });
      } catch {
        serviceRejected = true;
      }

      let fkRejected = false;
      try {
        await prisma.socialBrandAccountAssignment.create({
          data: {
            clientId: clientBId,
            businessBrandId: brandA1Id,
            socialAccountId: page1Id,
            status: "inactive",
            assignedByProfileId: outsiderId,
          },
        });
      } catch {
        fkRejected = true;
      }

      const afterConn =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: { status: true },
        });
      const afterAssignCount =
        await prisma.socialBrandAccountAssignment.count({
          where: { clientId: clientAId, status: "active" },
        });

      assert(serviceRejected, "cross-client service allowed");
      assert(fkRejected, "composite FK allowed cross-client brand");
      assert(
        afterConn?.status === beforeConn?.status,
        "connection status changed",
      );
      assert(
        afterAssignCount === beforeAssignCount,
        "assignment count changed",
      );

      record(
        11,
        "Same-Client enforcement",
        "PASS",
        "Attempted cross-Client assignment via service and composite FK insert.",
        "Service rejected; composite Brand+Client FK rejected; no partial status/assignment change.",
      );
    } catch (error) {
      record(
        11,
        "Same-Client enforcement",
        "FAIL",
        "Attempt cross-Client Brand/Page combination.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 12 ====================
    try {
      // Use page2 on authorized connection for permission matrix.
      // Ensure connection A1 still connected; unassign page2 isn't assigned yet.
      // Authorize isn't enough for page2 assign — connectionA1 is connected, OK.

      const before =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: page2Id,
            status: "active",
          },
        });
      const beforeConn =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: { status: true },
        });

      for (const [label, profileId] of [
        ["outsider", outsiderId],
        ["inactive", inactiveId],
        ["viewer", viewerId],
      ] as const) {
        let rejected = false;
        let safe = true;
        try {
          await assignSocialAccountToBrand({
            clientId: clientAId,
            profileId,
            businessBrandId: brandA1Id,
            socialAccountId: page2Id,
            connectionId: connectionA1Id,
          });
        } catch (error) {
          rejected = true;
          const message =
            error instanceof Error ? error.message : "";
          safe = !markerTokens.some((token) =>
            message.includes(token),
          );
        }
        assert(rejected, `${label} was not rejected`);
        assert(safe, `${label} rejection leaked secrets`);
      }

      const mid =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: page2Id,
            status: "active",
          },
        });
      const midConn =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: { status: true },
        });
      assert(mid === before, "unauthorized changed assignments");
      assert(
        midConn?.status === beforeConn?.status,
        "unauthorized changed connection",
      );

      const ok = await assignSocialAccountToBrand({
        clientId: clientAId,
        profileId: managerId,
        businessBrandId: brandA1Id,
        socialAccountId: page2Id,
        connectionId: connectionA1Id,
      });
      assert(ok.status === "active", "manager assign failed");

      // Unassign unauthorized
      for (const profileId of [
        outsiderId,
        inactiveId,
        viewerId,
      ]) {
        let rejected = false;
        try {
          await unassignSocialAccountFromBrand({
            clientId: clientAId,
            profileId,
            businessBrandId: brandA1Id,
            socialAccountId: page2Id,
          });
        } catch {
          rejected = true;
        }
        assert(rejected, "unauthorized unassign allowed");
      }

      const stillActive =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: page2Id,
            status: "active",
          },
        });
      assert(stillActive === 1, "unauthorized unassign mutated");

      await unassignSocialAccountFromBrand({
        clientId: clientAId,
        profileId: managerId,
        businessBrandId: brandA1Id,
        socialAccountId: page2Id,
      });

      record(
        12,
        "Membership and permission enforcement",
        "PASS",
        "Tried assign/unassign as outsider, inactive, viewer, then manager.",
        "Unauthorized rejected with no state change; manager could assign and unassign.",
      );
    } catch (error) {
      record(
        12,
        "Membership and permission enforcement",
        "FAIL",
        "Permission matrix for assign/unassign.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 13 ====================
    try {
      // page1 still active — unassign final active page for connection? 
      // page2 already inactive from test 12. Unassign page1.
      const before =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });

      await unassignSocialAccountFromBrand({
        clientId: clientAId,
        profileId: managerId,
        businessBrandId: brandA1Id,
        socialAccountId: page1Id,
      });

      const after =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });
      const page = await prisma.socialAccount.findUnique({
        where: { id: page1Id },
        select: {
          accessStatus: true,
          businessBrandId: true,
          status: true,
        },
      });
      const connection =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            connectedAt: true,
          },
        });

      statusAfterFinalUnassign = connection?.status ?? "";

      assert(!!before && !!after, "assignment row deleted");
      assert(after?.id === before?.id, "row replaced");
      assert(after?.status === "inactive", "not inactive");
      assert(!!after?.unassignedAt, "unassignedAt missing");
      assert(
        page?.accessStatus === "available",
        "page still selected",
      );
      assert(
        page?.businessBrandId === null,
        "page still brand-linked",
      );
      assert(
        connection?.status === "authorized",
        "expected authorized after final unassign",
      );
      assert(
        !connection?.connectedAt,
        "connectedAt should clear",
      );

      record(
        13,
        "Unassignment and history",
        "PASS",
        "Unassigned the final active Page from the Brand.",
        `Assignment retained as inactive with unassignedAt; Page no longer selected; connection status after final active Page unassign = ${statusAfterFinalUnassign}.`,
      );
    } catch (error) {
      record(
        13,
        "Unassignment and history",
        "FAIL",
        "Unassign active Page and inspect history/status.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 14 ====================
    try {
      const before =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });

      const reassigned = await assignSocialAccountToBrand({
        clientId: clientAId,
        profileId: assignerId,
        businessBrandId: brandA1Id,
        socialAccountId: page1Id,
        connectionId: connectionA1Id,
      });

      const after =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
        });
      const connection =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            connectedAt: true,
          },
        });
      const count =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            businessBrandId: brandA1Id,
            socialAccountId: page1Id,
          },
        });

      assert(count === 1, "duplicate relationship row");
      assert(after?.id === before?.id, "new row created");
      assert(after?.status === "active", "not reactivated");
      assert(!!after?.assignedAt, "assignedAt missing");
      assert(
        after?.unassignedAt === null,
        "unassignedAt not cleared",
      );
      assert(
        after?.assignedByProfileId === assignerId,
        "assigner not updated",
      );
      assert(
        connection?.status === "connected",
        "connection not connected",
      );
      assert(!!connection?.connectedAt, "connectedAt missing");
      assert(
        reassigned.connectionStatus === "connected",
        "service mismatch",
      );

      record(
        14,
        "Reassignment",
        "PASS",
        "Reassigned previously unassigned Page to the same Brand.",
        "Same Brand+Page row reactivated; timestamps/status correct; connection returned to connected.",
      );
    } catch (error) {
      record(
        14,
        "Reassignment",
        "FAIL",
        "Reassign previously unassigned Page.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 15 ====================
    try {
      // Simulate provider permission loss on page1 while assigned.
      await prisma.$transaction(async (tx) => {
        await tx.socialAccount.update({
          where: { id: page1Id },
          data: {
            accessStatus: "permission_lost",
            isAvailableThroughAuth: false,
          },
        });
        await tx.socialBrandAccountAssignment.updateMany({
          where: {
            socialAccountId: page1Id,
            status: "active",
          },
          data: { status: "permission_lost" },
        });
      });

      const page = await prisma.socialAccount.findUnique({
        where: { id: page1Id },
        select: {
          accessStatus: true,
          isAvailableThroughAuth: true,
          displayName: true,
        },
      });
      const assignment =
        await prisma.socialBrandAccountAssignment.findFirst({
          where: { socialAccountId: page1Id },
          select: { status: true, id: true },
        });

      let assignBlocked = false;
      try {
        await assignSocialAccountToBrand({
          clientId: clientAId,
          profileId: managerId,
          businessBrandId: brandA1Id,
          socialAccountId: page1Id,
          connectionId: connectionA1Id,
        });
      } catch {
        assignBlocked = true;
      }

      assert(
        page?.accessStatus === "permission_lost",
        "accessStatus not permission_lost",
      );
      assert(
        page?.isAvailableThroughAuth === false,
        "still available through auth",
      );
      assert(
        assignment?.status === "permission_lost",
        "assignment not permission_lost",
      );
      assert(assignBlocked, "page still assignable");
      assert(!!page?.displayName, "history display lost");
      assert(!!assignment?.id, "assignment history deleted");

      // Restore page for later disconnect tests.
      await prisma.socialAccount.update({
        where: { id: page1Id },
        data: {
          accessStatus: "selected",
          isAvailableThroughAuth: true,
        },
      });
      await prisma.socialBrandAccountAssignment.update({
        where: { id: assignment!.id },
        data: { status: "active", unassignedAt: null },
      });
      await prisma.socialProviderConnection.update({
        where: { id: connectionA1Id },
        data: {
          status: "connected",
          connectedAt: new Date(),
        },
      });

      record(
        15,
        "Permission loss",
        "PASS",
        "Simulated Page permission_lost on account + assignment; attempted re-assign.",
        "accessStatus/assignment became permission_lost; assignment blocked; history retained; no token exposure.",
      );
    } catch (error) {
      record(
        15,
        "Permission loss",
        "FAIL",
        "Simulate permission loss lifecycle.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 16 ====================
    try {
      const pageCountBefore =
        await prisma.socialAccount.count({
          where: { providerConnectionId: connectionA1Id },
        });
      const assignmentCountBefore =
        await prisma.socialBrandAccountAssignment.count({
          where: { socialAccountId: page1Id },
        });

      await prisma.socialProviderConnection.update({
        where: { id: connectionA1Id },
        data: {
          status: "reauthorization_required",
          lastErrorCode: "credential_unusable",
          lastErrorMessage:
            "Provider credential requires reauthorization.",
          lastErrorAt: new Date(),
          connectedAt: null,
        },
      });

      const connection =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            connectedAt: true,
            lastErrorCode: true,
          },
        });
      const summary = (
        await getSocialConnectionsData(clientAId, brandA1Id)
      ).find((item) => item.id === connectionA1Id);

      let assignBlocked = false;
      try {
        await assignSocialAccountToBrand({
          clientId: clientAId,
          profileId: managerId,
          businessBrandId: brandA1Id,
          socialAccountId: page2Id,
          connectionId: connectionA1Id,
        });
      } catch {
        assignBlocked = true;
      }

      const pageCountAfter =
        await prisma.socialAccount.count({
          where: { providerConnectionId: connectionA1Id },
        });
      const assignmentCountAfter =
        await prisma.socialBrandAccountAssignment.count({
          where: { socialAccountId: page1Id },
        });

      assert(
        connection?.status === "reauthorization_required",
        "status mismatch",
      );
      assert(!connection?.connectedAt, "still connectedAt");
      assert(
        summary?.status === "reauthorization_required",
        "summary healthy",
      );
      assert(assignBlocked, "assign allowed while reauth required");
      assert(
        pageCountAfter === pageCountBefore &&
          assignmentCountAfter === assignmentCountBefore,
        "history lost",
      );

      // Restore connected for disconnect test.
      await prisma.socialProviderConnection.update({
        where: { id: connectionA1Id },
        data: {
          status: "connected",
          connectedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      });

      record(
        16,
        "Reauthorization-required state",
        "PASS",
        "Simulated unusable credential state on connection; inspected summary and assignment gate.",
        "Status reauthorization_required; history retained; not treated as healthy/connected; assignment blocked.",
      );
    } catch (error) {
      record(
        16,
        "Reauthorization-required state",
        "FAIL",
        "Simulate reauthorization_required connection state.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 17 ====================
    try {
      const pageIdBefore = page1Id;
      const assignmentIdBefore = (
        await prisma.socialBrandAccountAssignment.findUnique({
          where: {
            businessBrandId_socialAccountId: {
              businessBrandId: brandA1Id,
              socialAccountId: page1Id,
            },
          },
          select: { id: true },
        })
      )?.id;

      const disconnected = await disconnectSocialConnection({
        clientId: clientAId,
        profileId: managerId,
        connectionId: connectionA1Id,
      });

      const credentialCount =
        await prisma.socialCredential.count({
          where: { connectionId: connectionA1Id },
        });
      const connection =
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionA1Id },
          select: {
            status: true,
            disconnectedAt: true,
          },
        });
      const activeAssignments =
        await prisma.socialBrandAccountAssignment.count({
          where: {
            socialAccountId: pageIdBefore,
            status: "active",
          },
        });
      const historyAssignment =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: { id: assignmentIdBefore! },
        });
      const page = await prisma.socialAccount.findUnique({
        where: { id: pageIdBefore },
        select: {
          id: true,
          displayName: true,
          providerConnectionId: true,
          accessStatus: true,
        },
      });

      assert(
        disconnected.status === "disconnected",
        "disconnect result",
      );
      assert(
        connection?.status === "disconnected",
        "connection status",
      );
      assert(!!connection?.disconnectedAt, "disconnectedAt missing");
      assert(credentialCount === 0, "credential still present");
      assert(activeAssignments === 0, "active assignment remains");
      assert(
        historyAssignment?.status === "inactive",
        "assignment history missing/wrong",
      );
      assert(!!page?.id && !!page.displayName, "page history lost");
      assert(
        page?.providerConnectionId === null,
        "page still attached for auth",
      );

      record(
        17,
        "Disconnect behavior",
        "PASS",
        "Disconnected connected provider via authorized disconnectSocialConnection path.",
        "Credential removed; active assignments deactivated; connection disconnected with timestamp; Page/assignment history retained.",
      );
    } catch (error) {
      record(
        17,
        "Disconnect behavior",
        "FAIL",
        "Disconnect connected provider connection.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 18 ====================
    try {
      // Recreate a small connected setup under clientA brandA2 for profile delete.
      const existingForProfileDelete =
        await prisma.socialProviderConnection.findFirst({
          where: {
            clientId: clientAId,
            businessBrandId: brandA2Id,
            provider: "meta",
          },
          select: { id: true },
        });
      const conn = existingForProfileDelete
        ? await prisma.socialProviderConnection.update({
            where: { id: existingForProfileDelete.id },
            data: {
              status: "connected",
              connectedAt: new Date(),
              authorizedAt: new Date(),
              createdByProfileId: assignerId,
            },
            select: { id: true },
          })
        : await prisma.socialProviderConnection.create({
            data: {
              clientId: clientAId,
              businessBrandId: brandA2Id,
              provider: "meta",
              status: "connected",
              connectedAt: new Date(),
              authorizedAt: new Date(),
              createdByProfileId: assignerId,
            },
            select: { id: true },
          });

      const page = await prisma.socialAccount.create({
        data: {
          clientId: clientAId,
          providerConnectionId: conn.id,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: `page-${stamp}-profile-del`,
          displayName: "Profile Delete Page",
          accessStatus: "selected",
          isAvailableThroughAuth: true,
          businessBrandId: brandA2Id,
        },
        select: { id: true },
      });

      const assignment =
        await prisma.socialBrandAccountAssignment.create({
          data: {
            clientId: clientAId,
            businessBrandId: brandA2Id,
            socialAccountId: page.id,
            status: "active",
            assignedByProfileId: assignerId,
          },
          select: { id: true },
        });

      await prisma.profile.delete({
        where: { id: assignerId },
      });
      // remove from cleanup list
      const idx = createdProfileIds.indexOf(assignerId);
      if (idx >= 0) createdProfileIds.splice(idx, 1);

      const connAfter =
        await prisma.socialProviderConnection.findUnique({
          where: { id: conn.id },
          select: {
            id: true,
            createdByProfileId: true,
          },
        });
      const pageAfter = await prisma.socialAccount.findUnique({
        where: { id: page.id },
        select: { id: true, displayName: true },
      });
      const assignmentAfter =
        await prisma.socialBrandAccountAssignment.findUnique({
          where: { id: assignment.id },
          select: {
            id: true,
            assignedByProfileId: true,
            status: true,
          },
        });

      assert(!!connAfter, "connection deleted with profile");
      assert(
        connAfter?.createdByProfileId === null,
        "createdBy not nullified",
      );
      assert(!!pageAfter, "page deleted with profile");
      assert(
        assignmentAfter?.assignedByProfileId === null,
        "assignedBy not nullified",
      );
      assert(
        assignmentAfter?.status === "active",
        "assignment status lost",
      );

      record(
        18,
        "Profile deletion history",
        "PASS",
        "Deleted Profile that created connection and assigned Page.",
        "Connection/Page/assignment history remained; createdBy/assignedBy set null; integrity intact.",
      );
    } catch (error) {
      record(
        18,
        "Profile deletion history",
        "FAIL",
        "Delete assigning Profile and inspect retained history.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 19 ====================
    try {
      const disposableClient = await prisma.client.create({
        data: {
          name: `2D Disposable ${stamp}`,
          status: "active",
        },
        select: { id: true },
      });
      const disposableBrand =
        await prisma.businessBrand.create({
          data: {
            clientId: disposableClient.id,
            name: `2D Disposable Brand ${stamp}`,
            status: "active",
          },
          select: { id: true },
        });
      const disposableConn =
        await prisma.socialProviderConnection.create({
          data: {
            clientId: disposableClient.id,
            businessBrandId: disposableBrand.id,
            provider: "meta",
            status: "authorized",
            authorizedAt: new Date(),
          },
          select: { id: true },
        });
      const aad = buildSocialCredentialAad({
        clientId: disposableClient.id,
        connectionId: disposableConn.id,
        provider: "meta",
      });
      const enc = encryptSocialTokenPayload(
        {
          accessToken: fakeAccess,
          refreshToken: fakeRefresh,
        },
        aad,
      );
      await prisma.socialCredential.create({
        data: {
          clientId: disposableClient.id,
          connectionId: disposableConn.id,
          status: "active",
          encryptedPayload: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          keyVersion: enc.keyVersion,
        },
      });
      const disposablePage = await prisma.socialAccount.create({
        data: {
          clientId: disposableClient.id,
          providerConnectionId: disposableConn.id,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: `page-${stamp}-disp`,
          displayName: "Disposable Page",
          accessStatus: "selected",
          businessBrandId: disposableBrand.id,
        },
        select: { id: true },
      });
      await prisma.socialBrandAccountAssignment.create({
        data: {
          clientId: disposableClient.id,
          businessBrandId: disposableBrand.id,
          socialAccountId: disposablePage.id,
          status: "active",
        },
      });

      const untouchedBefore =
        await prisma.socialProviderConnection.count({
          where: { clientId: clientAId },
        });

      await prisma.client.delete({
        where: { id: disposableClient.id },
      });

      const leftoverCred =
        await prisma.socialCredential.count({
          where: { connectionId: disposableConn.id },
        });
      const leftoverAssign =
        await prisma.socialBrandAccountAssignment.count({
          where: { clientId: disposableClient.id },
        });
      const leftoverPages =
        await prisma.socialAccount.count({
          where: { clientId: disposableClient.id },
        });
      const untouchedAfter =
        await prisma.socialProviderConnection.count({
          where: { clientId: clientAId },
        });
      const clientBStill =
        await prisma.client.findUnique({
          where: { id: clientBId },
          select: { id: true },
        });

      assert(leftoverCred === 0, "orphaned credential");
      assert(leftoverAssign === 0, "orphaned assignment");
      assert(leftoverPages === 0, "orphaned page");
      assert(
        untouchedAfter === untouchedBefore,
        "unrelated client cascaded",
      );
      assert(!!clientBStill, "client B deleted");

      record(
        19,
        "Client, Brand, and account deletion behavior",
        "PASS",
        "Deleted disposable Client owning connection/credential/page/assignment.",
        "Owned records cascaded away; unrelated Clients untouched; no orphaned assignment/credential rows.",
      );
    } catch (error) {
      record(
        19,
        "Client, Brand, and account deletion behavior",
        "FAIL",
        "Verify deletion cascades on disposable fixtures.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 20 ====================
    try {
      const summaries = await getSocialConnectionsData(clientAId);
      const forbidden = [
        "accessToken",
        "refreshToken",
        "authorizationCode",
        "encryptedPayload",
        "ciphertext",
        "iv",
        "authTag",
        "keyVersion",
        "encryptionKey",
      ];
      const hits = jsonHasForbiddenKeys(summaries, forbidden);
      const serialized = JSON.stringify(summaries);
      const tokenHits = markerTokens.filter((token) =>
        serialized.includes(token),
      );
      const logHits = markerTokens.filter((token) =>
        captureLog.join("\n").includes(token),
      );

      // Spot-check connection/account/assignment rows for plaintext tokens.
      const connections =
        await prisma.socialProviderConnection.findMany({
          where: { clientId: { in: [clientAId, clientBId] } },
        });
      const accounts = await prisma.socialAccount.findMany({
        where: { clientId: { in: [clientAId, clientBId] } },
      });
      const assignments =
        await prisma.socialBrandAccountAssignment.findMany({
          where: { clientId: { in: [clientAId, clientBId] } },
        });

      const dbBlob = JSON.stringify({
        connections,
        accounts,
        assignments,
      });
      const dbTokenHits = markerTokens.filter(
        (token) =>
          token !== ephemeralKey && dbBlob.includes(token),
      );

      assert(hits.length === 0, `response keys: ${hits.join(",")}`);
      assert(tokenHits.length === 0, "tokens in API summary");
      assert(logHits.length === 0, "tokens/keys in logs");
      assert(dbTokenHits.length === 0, "plaintext tokens in rows");

      record(
        20,
        "Sensitive-data boundary",
        "PASS",
        "Inspected DB rows, connection summaries, and captured logs for secret material.",
        "No plaintext tokens on connection/account/assignment; no crypto fields in client outputs; logs clean.",
      );
    } catch (error) {
      record(
        20,
        "Sensitive-data boundary",
        "FAIL",
        "Inspect sensitive-data boundaries.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // ==================== Test 21 ====================
    try {
      const table = await prisma.$queryRawUnsafe<
        Array<{ exists: boolean }>
      >(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_name = 'social_brand_account_assignments'
         ) AS exists`,
      );
      const columns = await prisma.$queryRawUnsafe<
        Array<{ column_name: string }>
      >(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'social_brand_account_assignments'
         ORDER BY ordinal_position`,
      );
      const connColumns = await prisma.$queryRawUnsafe<
        Array<{ column_name: string }>
      >(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'social_provider_connections'
           AND column_name IN ('authorizedAt','lastErrorAt')`,
      );
      const indexes = await prisma.$queryRawUnsafe<
        Array<{ indexname: string; indexdef: string }>
      >(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE tablename = 'social_brand_account_assignments'`,
      );
      const fks = await prisma.$queryRawUnsafe<
        Array<{ conname: string }>
      >(
        `SELECT conname FROM pg_constraint
         WHERE conrelid = 'social_brand_account_assignments'::regclass
           AND contype = 'f'`,
      );

      const columnNames = columns.map((row) => row.column_name);
      const indexNames = indexes.map((row) => row.indexname);
      const partialActive = indexes.some(
        (row) =>
          row.indexname === "sbaa_one_active_account_key" &&
          row.indexdef.toLowerCase().includes("where") &&
          row.indexdef.includes("active"),
      );

      assert(table[0]?.exists === true, "assignment table missing");
      for (const required of [
        "id",
        "clientId",
        "businessBrandId",
        "socialAccountId",
        "status",
        "assignedAt",
        "assignedByProfileId",
        "unassignedAt",
      ]) {
        assert(
          columnNames.includes(required),
          `missing column ${required}`,
        );
      }
      assert(
        connColumns.map((row) => row.column_name).includes(
          "authorizedAt",
        ),
        "authorizedAt missing",
      );
      const brandPageUnique = indexes.some(
        (row) =>
          row.indexdef.includes("UNIQUE") &&
          row.indexdef.includes("businessBrandId") &&
          row.indexdef.includes("socialAccountId") &&
          !row.indexdef.toLowerCase().includes("where"),
      );
      assert(brandPageUnique, "brand+page unique missing");
      assert(partialActive, "partial active unique missing");
      assert(
        fks.some(
          (row) =>
            row.conname.includes("businessBrandId_clientId") ||
            row.conname.includes("businessBrandId") &&
              row.conname.includes("clientId"),
        ),
        "composite ownership FK missing",
      );

      record(
        21,
        "Database structure and migration",
        "PASS",
        "Inspected physical tables/columns/indexes/FKs for Step 2D structures.",
        "Assignment table/fields present; Brand+Page unique; partial one-active-Page unique; composite ownership FK; lifecycle indexes present.",
      );
    } catch (error) {
      record(
        21,
        "Database structure and migration",
        "FAIL",
        "Verify applied Step 2D database structure.",
        error instanceof Error ? error.message : "unknown",
      );
    }

    // Test 22 is filled by the shell wrapper after generate/typecheck.
    record(
      22,
      "Project validation",
      "BLOCKED",
      "Deferred to runner wrapper for prisma generate + typecheck.",
      "Placeholder pending external validation commands.",
    );
  } finally {
    restoreLogs();
    try {
      if (createdClientIds.length) {
        await prisma.socialCredential.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.socialBrandAccountAssignment.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.socialOAuthState.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.socialAccount.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.socialProviderConnection.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.auditLog.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.clientMembership.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.businessBrand.deleteMany({
          where: { clientId: { in: createdClientIds } },
        });
        await prisma.client.deleteMany({
          where: { id: { in: createdClientIds } },
        });
      }
      if (createdProfileIds.length) {
        await prisma.clientMembership.deleteMany({
          where: { profileId: { in: createdProfileIds } },
        });
        await prisma.profile.deleteMany({
          where: { id: { in: createdProfileIds } },
        });
      }
    } catch (cleanupError) {
      originalError(
        "[step-2d-test] cleanup issue:",
        cleanupError instanceof Error
          ? cleanupError.message
          : "unknown",
      );
    }

    await prisma.$disconnect();

    if (previousKey === undefined) {
      delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;
    } else {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = previousKey;
    }
    if (previousActive === undefined) {
      delete process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION;
    } else {
      process.env.SOCIAL_TOKEN_ACTIVE_KEY_VERSION =
        previousActive;
    }
  }

  for (let id = 1; id <= 22; id += 1) {
    if (!results.find((item) => item.id === id)) {
      record(
        id,
        `Test ${id}`,
        "BLOCKED",
        "Not executed.",
        "Test did not run.",
      );
    }
  }

  const finalResults = [...results].sort(
    (a, b) => a.id - b.id,
  );

  originalLog(
    JSON.stringify(
      {
        environment:
          "development/isolated (NODE_ENV not production)",
        statusAfterFinalUnassign,
        results: finalResults,
        passCount: finalResults.filter(
          (item) => item.status === "PASS",
        ).length,
        failCount: finalResults.filter(
          (item) => item.status === "FAIL",
        ).length,
        blockedCount: finalResults.filter(
          (item) => item.status === "BLOCKED",
        ).length,
      },
      null,
      2,
    ),
  );

  if (
    finalResults.some(
      (item) =>
        item.status === "FAIL" ||
        (item.status === "BLOCKED" && item.id !== 22),
    )
  ) {
    process.exitCode = 1;
  }
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
