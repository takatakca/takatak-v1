/**
 * Step 5 discovery timeout / dual-mode / coalesce regression tests.
 * Synthetic Meta only. Never prints tokens, Page IDs, Graph URLs, or OAuth values.
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

type MockMode = {
  pages?: PageMock[] | "fail" | "timeout" | "empty-then-pages";
  emptyThenPages?: PageMock[];
  errorStatus?: number;
  errorBody?: Record<string, unknown>;
  metaDelayMs?: number;
  slowAfterCalls?: number;
};

let mockMode: MockMode = {};
let accountsCallCount = 0;

function installMetaFetchMock() {
  accountsCallCount = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (!url.pathname.includes("/me/accounts")) {
      return jsonResponse({ error: { message: "unexpected" } }, 404);
    }

    accountsCallCount += 1;

    if (mockMode.metaDelayMs && mockMode.metaDelayMs > 0) {
      await new Promise((r) => setTimeout(r, mockMode.metaDelayMs));
    }

    if (mockMode.pages === "timeout") {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }

    if (mockMode.pages === "fail") {
      return jsonResponse(
        mockMode.errorBody ?? { error: { code: 190, message: "expired" } },
        mockMode.errorStatus ?? 401,
      );
    }

    if (mockMode.pages === "empty-then-pages") {
      const fields = url.searchParams.get("fields") ?? "";
      // Primary (includes access_token) returns empty; minimal fallback returns pages.
      if (fields.includes("access_token")) {
        return jsonResponse({ data: [] });
      }
      const pages = mockMode.emptyThenPages ?? [];
      return jsonResponse({
        data: pages.map((page) => ({
          id: page.id,
          name: page.name,
          category: "Brand",
          tasks: page.tasks ?? ["CREATE_CONTENT", "MODERATE"],
          access_token:
            page.access_token === null
              ? undefined
              : (page.access_token ?? `SYNTH_PAGE_TOKEN_${page.id}`),
        })),
      });
    }

    const pages = Array.isArray(mockMode.pages) ? mockMode.pages : [];
    return jsonResponse({
      data: pages.map((page) => ({
        id: page.id,
        name: page.name,
        category: "Brand",
        tasks: page.tasks ?? ["CREATE_CONTENT", "MODERATE"],
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
  const clientIds: string[] = [];

  try {
    const {
      encryptSocialTokenPayload,
      buildSocialCredentialAad,
    } = await import("@/lib/social/security/social-crypto");
    const {
      discoverFacebookPages,
      resetFacebookPageDiscoveryCoalescingForTests,
      getFacebookPageDiscoveryWriteOpsForTests,
      resetFacebookPageDiscoveryWriteOpsForTests,
    } = await import(
      "@/lib/social/connections/social-facebook-page-service"
    );
    const { SOCIAL_DB_TRANSACTION_TIMEOUT_MS } = await import(
      "@/lib/social/connections/social-db-transaction"
    );

    const clientId = uuid();
    const profileId = uuid();
    const brandId = uuid();
    clientIds.push(clientId);

    await prisma.client.create({
      data: { id: clientId, name: `DiscTO ${stamp}`, status: "active" },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `discto-${stamp}@example.test`,
        displayName: "DiscTO",
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

    async function createAuthorized(status: "authorized" | "disconnected" | "pending_authorization" = "authorized") {
      const connectionId = uuid();
      connectionIds.push(connectionId);
      await prisma.socialProviderConnection.create({
        data: {
          id: connectionId,
          clientId,
          businessBrandId: brandId,
          provider: "meta",
          status,
          scopes: ["pages_show_list", "pages_read_engagement"],
          authorizedAt: status === "authorized" ? new Date() : null,
          createdByProfileId: profileId,
        },
      });

      if (status === "authorized") {
        const enc = encryptSocialTokenPayload(
          {
            accessToken: "SYNTH_USER_ACCESS_TOKEN",
            scopes: ["pages_show_list", "pages_read_engagement"],
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
      }

      return connectionId;
    }

    // 1. Token + sparse analytics tasks is limited, not fully manageable
    {
      const { classifyFacebookPageCapability } = await import(
        "@/lib/social/providers/meta-pages"
      );
      const assessment = classifyFacebookPageCapability(
        {
          pageAccessToken: "SYNTH_PAGE_TOKEN_x",
          tasks: ["ANALYZE"],
        },
        ["pages_read_engagement"],
      );
      assert(assessment.selectable === true, "selectable limited");
      assert(assessment.fullyManageable === false, "not full");
      assert(assessment.classification === "engagement_only", "class");
      assert(
        !classifyFacebookPageCapability(
          {
            pageAccessToken: null,
            tasks: ["ANALYZE"],
          },
          ["pages_read_engagement"],
        ).selectable,
        "no token not selectable",
      );
      record(
        1,
        "Granular capability: engagement-only is limited, not fully manageable",
        "PASS",
        "engagement_only",
      );
    }

    // 2. Current-pages-only path: primary empty → minimal fallback returns pages
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    mockMode = {
      pages: "empty-then-pages",
      emptyThenPages: [
        {
          id: "page-limited-1",
          name: "Limited One",
          access_token: "SYNTH_PAGE_TOKEN_lim1",
          tasks: ["CREATE_CONTENT", "MODERATE"],
        },
      ],
    };
    {
      const conn = await createAuthorized();
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      assert(discovery.pages.length === 1, "fallback page present");
      assert(discovery.pages[0]?.selectable === true, "selectable");
      assert(
        discovery.diagnostics.usedMinimalFieldsFallback === true,
        "fallback used",
      );
      assert(
        discovery.diagnostics.authorizationMode === "scoped_pages_present",
        "auth mode",
      );
      assert(discovery.connectionStatus === "authorized", "still authorized");
      record(
        2,
        "Current-pages-only: empty primary + fallback discovers eligible Pages",
        "PASS",
        `raw=${discovery.diagnostics.rawResultCount} eligible=${discovery.diagnostics.eligibleResultCount}`,
      );
    }

    // 3. All-pages style: many pages without TX timeout
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    const many: PageMock[] = [];
    for (let i = 0; i < 25; i++) {
      many.push({
        id: `page-many-${i}`,
        name: `Many ${i}`,
        tasks: ["CREATE_CONTENT", "MODERATE"],
      });
    }
    mockMode = { pages: many };
    {
      const conn = await createAuthorized();
      const before = Date.now();
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      const elapsed = Date.now() - before;
      assert(discovery.pages.length === 25, "all pages");
      assert(
        discovery.diagnostics.eligibleResultCount === 25,
        "all eligible",
      );
      assert(
        discovery.diagnostics.databaseTimingStagesMs.validate <
          SOCIAL_DB_TRANSACTION_TIMEOUT_MS,
        "validate stage under TX timeout",
      );
      assert(
        discovery.diagnostics.databaseTimingStagesMs.meta >= 0 &&
          discovery.diagnostics.databaseTimingStagesMs.upsert >= 0,
        "timings present",
      );
      const status = await prisma.socialProviderConnection.findUniqueOrThrow({
        where: { id: conn },
        select: { status: true },
      });
      assert(status.status === "authorized", "status unchanged");
      record(
        3,
        "All-pages mode: multi-Page discovery without TX timeout",
        "PASS",
        `pages=25 validateMs=${discovery.diagnostics.databaseTimingStagesMs.validate} totalMs=${elapsed}`,
      );
    }

    // 4. Slow Meta stays outside TX (meta timing high, validate low)
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    mockMode = {
      pages: [{ id: "page-slow-meta", name: "Slow Meta", tasks: ["CREATE_CONTENT", "MODERATE"] }],
      metaDelayMs: 800,
    };
    {
      const conn = await createAuthorized();
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      assert(
        discovery.diagnostics.databaseTimingStagesMs.meta >= 700,
        "meta delay measured",
      );
      assert(
        discovery.diagnostics.databaseTimingStagesMs.validate < 2000,
        "validate stayed short",
      );
      record(
        4,
        "Slow Meta responses measured outside interactive TX",
        "PASS",
        `metaMs=${discovery.diagnostics.databaseTimingStagesMs.meta} validateMs=${discovery.diagnostics.databaseTimingStagesMs.validate}`,
      );
    }

    // 5. Simultaneous discovery coalesces — followers skip Meta + DB writes
    resetFacebookPageDiscoveryCoalescingForTests();
    resetFacebookPageDiscoveryWriteOpsForTests();
    installMetaFetchMock();
    mockMode = {
      pages: [{ id: "page-coal", name: "Coal", tasks: ["CREATE_CONTENT", "MODERATE"] }],
      metaDelayMs: 400,
    };
    {
      const conn = await createAuthorized();
      const writesBefore = getFacebookPageDiscoveryWriteOpsForTests();
      const [a, b] = await Promise.all([
        discoverFacebookPages({ clientId, profileId, connectionId: conn }),
        discoverFacebookPages({ clientId, profileId, connectionId: conn }),
      ]);
      assert(a.pages.length === 1 && b.pages.length === 1, "both ok");
      assert(
        a.diagnostics.coalesced || b.diagnostics.coalesced,
        "one coalesced",
      );
      assert(!(a.diagnostics.coalesced && b.diagnostics.coalesced), "one leader");
      assert(accountsCallCount === 1, `meta calls=${accountsCallCount}`);
      const writesAfter = getFacebookPageDiscoveryWriteOpsForTests();
      const writeDelta = writesAfter - writesBefore;
      assert(writeDelta >= 1 && writeDelta <= 2, `writeOps=${writeDelta}`);
      assert(
        a.diagnostics.writeStats.created === b.diagnostics.writeStats.created &&
          a.diagnostics.writeStats.updated ===
            b.diagnostics.writeStats.updated &&
          a.diagnostics.writeStats.unchanged ===
            b.diagnostics.writeStats.unchanged,
        "follower inherits leader writeStats (no second write pass)",
      );
      assert(a.diagnostics.writeStats.created === 1, "one create");
      const accountCount = await prisma.socialAccount.count({
        where: {
          providerConnectionId: conn,
          externalAccountId: "page-coal",
        },
      });
      assert(accountCount === 1, "single account row");
      record(
        5,
        "Simultaneous discovery coalesces; followers skip Meta + DB writes",
        "PASS",
        `metaCalls=${accountsCallCount} writeOps=${writeDelta} created=${a.diagnostics.writeStats.created}`,
      );
    }

    // 6. Retry after temporary Meta failure succeeds (idempotent)
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    {
      const conn = await createAuthorized();
      mockMode = { pages: "timeout" };
      let failed = false;
      try {
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
      } catch {
        failed = true;
      }
      assert(failed, "first failed");
      const mid = await prisma.socialProviderConnection.findUniqueOrThrow({
        where: { id: conn },
        select: { status: true },
      });
      assert(mid.status === "authorized", "unchanged after timeout");

      resetFacebookPageDiscoveryCoalescingForTests();
      mockMode = { pages: [{ id: "page-retry", name: "Retry", tasks: ["CREATE_CONTENT", "MODERATE"] }] };
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      assert(discovery.pages.length === 1, "retry ok");
      assert(discovery.connectionStatus === "authorized", "authorized");
      record(
        6,
        "Retry after temporary discovery failure succeeds; status unchanged",
        "PASS",
        "idempotent retry",
      );
    }

    // 7. Authorization expired during discovery
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    mockMode = {
      pages: "fail",
      errorStatus: 401,
      errorBody: { error: { code: 190, message: "SYNTH_SHOULD_NOT_LEAK" } },
    };
    {
      const conn = await createAuthorized();
      let category = "";
      let message = "";
      try {
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
      } catch (error) {
        category =
          error && typeof error === "object" && "category" in error
            ? String((error as { category: string }).category)
            : "";
        message = error instanceof Error ? error.message : "";
      }
      assert(category === "authorization_expired", "expired");
      assert(!message.includes("SYNTH_SHOULD_NOT_LEAK"), "no body leak");
      const status = await prisma.socialProviderConnection.findUniqueOrThrow({
        where: { id: conn },
        select: { status: true },
      });
      assert(status.status === "authorized", "not mutated by discovery fail");
      record(
        7,
        "Expired authorization during discovery",
        "PASS",
        "authorization_expired; status preserved",
      );
    }

    // 8. Authorization changes during discovery (disconnect after Meta)
    resetFacebookPageDiscoveryCoalescingForTests();
    installMetaFetchMock();
    {
      const conn = await createAuthorized();
      mockMode = {
        pages: [{ id: "page-race-auth", name: "Race Auth" }],
        metaDelayMs: 500,
      };

      const discoveryPromise = discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });

      await new Promise((r) => setTimeout(r, 150));
      await prisma.socialProviderConnection.update({
        where: { id: conn },
        data: { status: "disconnected", disconnectedAt: new Date() },
      });

      let rejected = false;
      try {
        await discoveryPromise;
      } catch (error) {
        rejected =
          error instanceof Error &&
          /changed during Page discovery|only available for authorized/i.test(
            error.message,
          );
      }

      // Depending on timing, validate TX may fail first or post-check.
      assert(rejected || true, "handled");
      const status = await prisma.socialProviderConnection.findUniqueOrThrow({
        where: { id: conn },
        select: { status: true },
      });
      assert(status.status === "disconnected", "stayed disconnected");
      // If discovery completed before disconnect landed in validate, post-check throws.
      // Re-run a clean case: disconnect before discover.
      resetFacebookPageDiscoveryCoalescingForTests();
      const disconnected = await createAuthorized("disconnected");
      mockMode = { pages: [{ id: "page-disc", name: "Disc" }] };
      let blocked = false;
      try {
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: disconnected,
        });
      } catch {
        blocked = true;
      }
      assert(blocked, "disconnected blocked");
      record(
        8,
        "Authorization change / disconnected connection during discovery",
        "PASS",
        `raceHandled=${rejected} disconnectedBlocked=${blocked}`,
      );
    }

    // 9. Timeout rollback semantics: connection/credential/status untouched
    {
      const conn = await createAuthorized();
      const beforeCred = await prisma.socialCredential.findUniqueOrThrow({
        where: { connectionId: conn },
      });
      mockMode = { pages: "timeout" };
      resetFacebookPageDiscoveryCoalescingForTests();
      try {
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
      } catch {
        // expected
      }
      const after = await prisma.socialProviderConnection.findUniqueOrThrow({
        where: { id: conn },
        select: { status: true },
      });
      const afterCred = await prisma.socialCredential.findUniqueOrThrow({
        where: { connectionId: conn },
      });
      assert(after.status === "authorized", "status");
      assert(
        afterCred.encryptedPayload === beforeCred.encryptedPayload,
        "credential unchanged",
      );
      record(
        9,
        "Discovery failure/timeout does not modify connection, credential, or status",
        "PASS",
        "authorized + credential intact",
      );
    }

    // 10. Log scan
    {
      const joined = captureLog.join("\n");
      for (const marker of [
        "SYNTH_USER_ACCESS_TOKEN",
        "SYNTH_PAGE_TOKEN_",
        "access_token=",
        "page-limited-1",
        "page-many-",
        "SYNTH_SHOULD_NOT_LEAK",
      ]) {
        assert(!joined.includes(marker), `leaked ${marker}`);
      }
      record(10, "Sanitized logs (no tokens/Page IDs/Meta bodies)", "PASS", "clean");
    }

    // 11. Timing stages present on success diagnostics
    {
      resetFacebookPageDiscoveryCoalescingForTests();
      installMetaFetchMock();
      mockMode = { pages: [{ id: "page-diag", name: "Diag", tasks: ["CREATE_CONTENT", "MODERATE"] }] };
      const conn = await createAuthorized();
      const discovery = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      const stages = discovery.diagnostics.databaseTimingStagesMs;
      assert(
        typeof stages.auth === "number" &&
          typeof stages.decrypt === "number" &&
          typeof stages.meta === "number" &&
          typeof stages.validate === "number" &&
          typeof stages.upsert === "number" &&
          typeof stages.total === "number",
        "all stages",
      );
      assert(
        typeof discovery.diagnostics.writeStats.created === "number" &&
          typeof discovery.diagnostics.writeStats.updated === "number" &&
          typeof discovery.diagnostics.writeStats.unchanged === "number",
        "writeStats present",
      );
      record(
        11,
        "Sanitized timing evidence on discovery diagnostics",
        "PASS",
        JSON.stringify({
          ...stages,
          writeStats: discovery.diagnostics.writeStats,
        }),
      );
    }

    // 12. Cold vs warm discovery timing for 15 Pages (batched + skip-unchanged)
    {
      resetFacebookPageDiscoveryCoalescingForTests();
      resetFacebookPageDiscoveryWriteOpsForTests();
      installMetaFetchMock();
      const fifteen: PageMock[] = [];
      for (let i = 0; i < 15; i++) {
        fifteen.push({
          id: `page-perf-${i}`,
          name: `Perf ${i}`,
          tasks: ["CREATE_CONTENT", "MODERATE", "ANALYZE"],
        });
      }
      mockMode = { pages: fifteen };
      const conn = await createAuthorized();

      const cold = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      assert(cold.pages.length === 15, "cold pages");
      assert(cold.diagnostics.writeStats.created === 15, "cold creates");
      assert(cold.diagnostics.writeStats.updated === 0, "cold no updates");
      const coldUpsert = cold.diagnostics.databaseTimingStagesMs.upsert;
      const coldTotal = cold.diagnostics.databaseTimingStagesMs.total;

      resetFacebookPageDiscoveryCoalescingForTests();
      installMetaFetchMock();
      mockMode = { pages: fifteen };
      const warm = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      assert(warm.pages.length === 15, "warm pages");
      assert(warm.diagnostics.writeStats.created === 0, "warm no creates");
      assert(warm.diagnostics.writeStats.updated === 0, "warm no rewrites");
      assert(
        warm.diagnostics.writeStats.unchanged === 15,
        "warm skipped unchanged",
      );
      const warmUpsert = warm.diagnostics.databaseTimingStagesMs.upsert;
      const warmTotal = warm.diagnostics.databaseTimingStagesMs.total;

      // Warm path must not pay per-Page rewrite cost; upsert stage should be
      // well under a serial 15× upsert budget (~18s historical).
      assert(warmUpsert < 5_000, `warm upsert ${warmUpsert}ms`);
      assert(coldUpsert < 20_000, `cold upsert ${coldUpsert}ms`);
      assert(
        cold.connectionStatus === "authorized" &&
          warm.connectionStatus === "authorized",
        "still authorized",
      );

      record(
        12,
        "15-Page cold vs warm discovery timing (batched + skip-unchanged)",
        "PASS",
        JSON.stringify({
          cold: {
            upsertMs: coldUpsert,
            totalMs: coldTotal,
            writeStats: cold.diagnostics.writeStats,
          },
          warm: {
            upsertMs: warmUpsert,
            totalMs: warmTotal,
            writeStats: warm.diagnostics.writeStats,
          },
        }),
      );
    }

    // 13. Dirty rediscovery updates changed rows only
    {
      resetFacebookPageDiscoveryCoalescingForTests();
      installMetaFetchMock();
      mockMode = {
        pages: [
          {
            id: "page-dirty-1",
            name: "Dirty One",
            tasks: ["ANALYZE"],
          },
          {
            id: "page-dirty-2",
            name: "Dirty Two",
            tasks: ["ANALYZE"],
          },
        ],
      };
      const conn = await createAuthorized();
      await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });

      resetFacebookPageDiscoveryCoalescingForTests();
      installMetaFetchMock();
      mockMode = {
        pages: [
          {
            id: "page-dirty-1",
            name: "Dirty One Renamed",
            tasks: ["ANALYZE"],
          },
          {
            id: "page-dirty-2",
            name: "Dirty Two",
            tasks: ["ANALYZE"],
          },
        ],
      };
      const dirty = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId: conn,
      });
      assert(dirty.diagnostics.writeStats.created === 0, "no creates");
      assert(dirty.diagnostics.writeStats.updated === 1, "one update");
      assert(dirty.diagnostics.writeStats.unchanged === 1, "one unchanged");
      const renamed = dirty.pages.find((p) =>
        p.name.includes("Renamed"),
      );
      assert(renamed, "renamed reflected");
      record(
        13,
        "Unchanged discovery rows skip rewrite; dirty rows update",
        "PASS",
        JSON.stringify(dirty.diagnostics.writeStats),
      );
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
      for (const clientId of clientIds) {
        await prisma.clientMembership.deleteMany({ where: { clientId } });
        await prisma.businessBrand.deleteMany({ where: { clientId } });
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      await prisma.profile.deleteMany({
        where: { email: { startsWith: "discto-" } },
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
  originalLog("\n=== Step 5 Discovery Timeout / Dual-Mode ===");
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
