/**
 * Step 5 capability policy: connectionEligible independent of publish/moderate.
 * Never prints tokens, Page IDs, or raw Meta bodies.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type Status = "PASS" | "FAIL" | "BLOCKED";
type Result = { id: number; name: string; status: Status; evidence: string };

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const results: Result[] = [];
const captureLog: string[] = [];
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalInfo = console.info;
const originalLog = console.log;
const originalWarn = console.warn;

function installLogCapture() {
  const wrap =
    (orig: typeof console.log) =>
    (...args: unknown[]) => {
      captureLog.push(
        args
          .map((v) =>
            typeof v === "string"
              ? v
              : v instanceof Error
                ? v.message
                : "[non-string]",
          )
          .join(" "),
      );
    };
  console.error = wrap(originalError);
  console.info = wrap(originalInfo);
  console.log = wrap(originalLog);
  console.warn = wrap(originalWarn);
}

function restoreLogs() {
  console.error = originalError;
  console.info = originalInfo;
  console.log = originalLog;
  console.warn = originalWarn;
}

function record(id: number, name: string, status: Status, evidence: string) {
  results.push({ id, name, status, evidence });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uuid(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type PageMock = {
  id: string;
  name: string;
  access_token?: string | null;
  tasks?: string[];
};

let pagesMode: PageMock[] | "revoked" = [];
let grantedPermissions: Array<{ permission: string; status: string }> = [];

function installMetaFetchMock() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.pathname.includes("/me/permissions")) {
      return jsonResponse({ data: grantedPermissions });
    }

    if (!url.pathname.includes("/me/accounts")) {
      return jsonResponse({ error: { message: "unexpected" } }, 404);
    }

    if (pagesMode === "revoked") {
      return jsonResponse({ data: [] });
    }

    const pages = Array.isArray(pagesMode) ? pagesMode : [];
    return jsonResponse({
      data: pages.map((page) => ({
        id: page.id,
        name: page.name,
        tasks: page.tasks ?? [],
        access_token:
          page.access_token === null
            ? undefined
            : (page.access_token ?? `SYNTH_PAGE_TOKEN_${page.id}`),
      })),
    });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function setGranted(perms: string[]) {
  grantedPermissions = perms.map((permission) => ({
    permission,
    status: "granted",
  }));
}

async function main() {
  if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1) {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = randomBytes(32).toString(
      "base64",
    );
  }
  installLogCapture();

  if (!process.env.DATABASE_URL) {
    record(0, "database", "BLOCKED", "DATABASE_URL missing");
    printSummary();
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stamp = Date.now().toString(36);
  const connectionIds: string[] = [];
  let clientId = "";

  try {
    const { classifyFacebookPageCapability } = await import(
      "@/lib/social/providers/meta-pages"
    );
    const {
      encryptSocialTokenPayload,
      buildSocialCredentialAad,
    } = await import("@/lib/social/security/social-crypto");
    const {
      discoverFacebookPages,
      selectFacebookPage,
      resetFacebookPageDiscoveryCoalescingForTests,
    } = await import(
      "@/lib/social/connections/social-facebook-page-service"
    );

    // 1. Current Step 5 scopes → connectionEligible=true; publish/moderate/full false
    {
      const step5 = classifyFacebookPageCapability(
        { pageAccessToken: "t", tasks: ["ANALYZE", "CREATE_CONTENT"] },
        ["public_profile", "pages_show_list", "pages_read_engagement"],
      );
      assert(step5.connectionEligible === true, "eligible");
      assert(step5.selectable === true, "selectable");
      assert(step5.canReadEngagement === true, "read");
      assert(step5.canPublish === false, "no publish");
      assert(step5.canModerate === false, "no moderate");
      assert(step5.fullyManageable === false, "not full");
      assert(step5.classification === "engagement_only", "class");
      record(
        1,
        "Step 5 scopes: connectionEligible=true; publish/moderate/full=false",
        "PASS",
        "engagement_only",
      );
    }

    // 2. Missing pages_read_engagement → connectionEligible=false
    {
      const missingRead = classifyFacebookPageCapability(
        {
          pageAccessToken: "t",
          tasks: ["CREATE_CONTENT", "MODERATE", "MANAGE"],
        },
        ["pages_show_list", "pages_manage_posts", "pages_manage_engagement"],
      );
      assert(missingRead.connectionEligible === false, "not eligible");
      assert(missingRead.selectable === false, "not selectable");
      assert(missingRead.canReadEngagement === false, "no read");
      // Publish/moderate may evaluate true but must not unlock connection.
      assert(missingRead.canPublish === true, "publish unrelated");
      assert(missingRead.canModerate === true, "moderate unrelated");
      assert(missingRead.fullyManageable === false, "not full without read");
      record(
        2,
        "Missing pages_read_engagement → connectionEligible=false",
        "PASS",
        "rejected even with publish/moderate OAuth",
      );
    }

    // 3. Missing live Page credential → connectionEligible=false
    {
      const noToken = classifyFacebookPageCapability(
        { pageAccessToken: null, tasks: ["CREATE_CONTENT", "MODERATE"] },
        [
          "pages_read_engagement",
          "pages_manage_posts",
          "pages_manage_engagement",
        ],
      );
      assert(noToken.connectionEligible === false, "not eligible");
      assert(noToken.selectable === false, "not selectable");
      assert(noToken.hasPageToken === false, "no token");
      assert(noToken.canPublish === false, "no publish without token");
      assert(noToken.canModerate === false, "no moderate without token");
      assert(noToken.classification === "insufficient", "class");
      record(
        3,
        "Missing live Page credential → connectionEligible=false",
        "PASS",
        "insufficient",
      );
    }

    // 4. pages_manage_engagement without MODERATE → canModerate=false
    {
      const a = classifyFacebookPageCapability(
        { pageAccessToken: "t", tasks: ["ANALYZE", "CREATE_CONTENT"] },
        ["pages_read_engagement", "pages_manage_engagement"],
      );
      assert(a.canModerate === false, "no MODERATE task");
      assert(a.connectionEligible === true, "still connectable");
      record(
        4,
        "pages_manage_engagement without MODERATE → canModerate=false",
        "PASS",
        "permission alone insufficient",
      );
    }

    // 5. MODERATE without pages_manage_engagement → canModerate=false
    {
      const a = classifyFacebookPageCapability(
        { pageAccessToken: "t", tasks: ["MODERATE"] },
        ["pages_read_engagement"],
      );
      assert(a.canModerate === false, "no oauth");
      assert(a.connectionEligible === true, "still connectable");
      record(
        5,
        "MODERATE without pages_manage_engagement → canModerate=false",
        "PASS",
        "task alone insufficient",
      );
    }

    // 6. Matching moderation task + permission → canModerate=true
    {
      const a = classifyFacebookPageCapability(
        { pageAccessToken: "t", tasks: ["MODERATE"] },
        ["pages_read_engagement", "pages_manage_engagement"],
      );
      assert(a.canModerate === true, "moderate");
      assert(a.connectionEligible === true, "eligible");
      assert(a.canPublish === false, "no publish");
      assert(a.fullyManageable === false, "not full");
      assert(a.classification === "moderation_only", "class");
      record(
        6,
        "Matching MODERATE + pages_manage_engagement → canModerate=true",
        "PASS",
        "moderation_only",
      );
    }

    clientId = uuid();
    const profileId = uuid();
    const brandId = uuid();
    await prisma.client.create({
      data: { id: clientId, name: `Cap3 ${stamp}`, status: "active" },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `cap3-${stamp}@example.test`,
        displayName: "Cap3",
        status: "active",
        role: "user",
      },
    });
    await prisma.clientMembership.create({
      data: {
        profileId,
        clientId,
        role: "owner",
        status: "active",
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: brandId,
        clientId,
        name: `Brand ${stamp}`,
        status: "active",
      },
    });

    async function createAuthorized(scopes: string[]) {
      const connectionId = uuid();
      connectionIds.push(connectionId);
      await prisma.socialProviderConnection.create({
        data: {
          id: connectionId,
          clientId,
          businessBrandId: brandId,
          provider: "meta",
          status: "authorized",
          scopes,
          authorizedAt: new Date(),
          createdByProfileId: profileId,
        },
      });
      const enc = encryptSocialTokenPayload(
        {
          accessToken: "SYNTH_USER_ACCESS_TOKEN",
          scopes,
        },
        buildSocialCredentialAad({
          clientId,
          connectionId,
          provider: "meta",
        }),
      );
      await prisma.socialCredential.create({
        data: {
          clientId,
          connectionId,
          status: "active",
          encryptedPayload: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          keyVersion: enc.keyVersion,
        },
      });
      return connectionId;
    }

    // 7. Discovery + selection persist connectionEligible; reject when false
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    pagesMode = [
      {
        id: "cap3-step5",
        name: "Step5 Page",
        tasks: ["ANALYZE"],
      },
    ];
    setGranted(["public_profile", "pages_show_list", "pages_read_engagement"]);
    {
      const conn = await createAuthorized([
        "public_profile",
        "pages_show_list",
        "pages_read_engagement",
      ]);
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      const page = discovery.pages[0]!;
      assert(page.connectionEligible === true, "disc eligible");
      assert(page.selectable === true, "disc selectable");
      assert(page.canPublish === false, "disc no publish");
      assert(page.canModerate === false, "disc no moderate");
      assert(page.fullyManageable === false, "disc not full");

      const selection = await selectFacebookPage({
        clientId,
        profileId,
        connectionId: conn,
        socialAccountId: page.socialAccountId,
      });
      assert(selection.connectionEligible === true, "sel eligible");
      assert(selection.canPublish === false, "sel no publish");
      assert(selection.fullyManageable === false, "sel not full");

      const account = await prisma.socialAccount.findFirstOrThrow({
        where: { id: selection.socialAccountId },
      });
      const meta = account.metadata as Record<string, unknown>;
      assert(meta.connectionEligible === true, "stored eligible");
      assert(meta.canPublish === false, "stored no publish");
      assert(meta.permissionsVerifiedAt, "verified");
      record(
        7,
        "Discovery/selection/metadata include connectionEligible",
        "PASS",
        "persisted + Step 5 limited connect",
      );
    }

    // 8. Selection rejects when connectionEligible=false despite publish OAuth
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    pagesMode = [
      {
        id: "cap3-reject",
        name: "Reject Page",
        tasks: ["CREATE_CONTENT", "MODERATE"],
      },
    ];
    setGranted([
      "pages_show_list",
      "pages_manage_posts",
      "pages_manage_engagement",
    ]);
    {
      const conn = await createAuthorized([
        "pages_show_list",
        "pages_manage_posts",
        "pages_manage_engagement",
      ]);
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      const page = discovery.pages[0]!;
      assert(page.connectionEligible === false, "disc not eligible");
      assert(page.selectable === false, "disc not selectable");

      let rejected = false;
      try {
        await selectFacebookPage({
          clientId,
          profileId,
          connectionId: conn,
          socialAccountId: page.socialAccountId,
        });
      } catch (error) {
        rejected =
          error instanceof Error &&
          /not eligible|pages_read_engagement/i.test(error.message);
      }
      assert(rejected, "selection rejected");
      record(
        8,
        "Selection rejects connectionEligible=false despite publish/moderate",
        "PASS",
        "permission_required",
      );
    }

    // 9. Log scan
    {
      const joined = captureLog.join("\n");
      for (const marker of [
        "SYNTH_USER_ACCESS_TOKEN",
        "SYNTH_PAGE_TOKEN_",
        "cap3-step5",
        "cap3-reject",
        "access_token=",
      ]) {
        assert(!joined.includes(marker), `leaked ${marker}`);
      }
      record(9, "Logs free of tokens and Page IDs", "PASS", "clean");
    }
  } catch (error) {
    record(
      99,
      "Suite harness",
      "FAIL",
      error instanceof Error ? error.message : "unknown",
    );
  } finally {
    restoreFetch();
    restoreLogs();
    try {
      if (connectionIds.length) {
        await prisma.socialBrandAccountAssignment.deleteMany({
          where: {
            socialAccount: {
              providerConnectionId: { in: connectionIds },
            },
          },
        });
        await prisma.socialAccount.deleteMany({
          where: { providerConnectionId: { in: connectionIds } },
        });
        await prisma.socialCredential.deleteMany({
          where: { connectionId: { in: connectionIds } },
        });
        await prisma.socialProviderConnection.deleteMany({
          where: { id: { in: connectionIds } },
        });
      }
      if (clientId) {
        await prisma.clientMembership.deleteMany({ where: { clientId } });
        await prisma.businessBrand.deleteMany({ where: { clientId } });
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      await prisma.profile.deleteMany({
        where: { email: { startsWith: "cap3-" } },
      });
    } catch {
      // ignore
    }
    await prisma.$disconnect();
  }

  printSummary();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  originalLog("\n=== Step 5 connectionEligible Capability Policy ===");
  for (const result of results) {
    originalLog(
      `[${result.status}] #${result.id} ${result.name} — ${result.evidence}`,
    );
  }
  originalLog(`\nSummary: ${passed} passed, ${failed} failed`);
}

main().catch((error) => {
  restoreFetch();
  restoreLogs();
  originalError(error);
  process.exit(1);
});
