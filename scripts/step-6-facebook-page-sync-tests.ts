/**
 * Step 6 — Facebook Page initial sync + dashboard state tests.
 * Synthetic Meta only. Never prints tokens, Page IDs, or raw Graph payloads.
 */

import { randomBytes, randomUUID } from "node:crypto";
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
      // keep quiet during suite
      void orig;
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

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function uuid(): string {
  return randomUUID();
}

function hex(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

async function main() {
  installLogCapture();
  const prisma = new PrismaClient();

  const {
    claimFacebookPageSync,
    enqueueInitialFacebookPageSync,
    getSelectedFacebookPageSyncSnapshot,
    listSelectedFacebookPageMetrics,
    resetFacebookPageSyncCoalescingForTests,
    runInitialFacebookPageSync,
  } = await import(
    "../src/lib/social/sync/facebook-page-initial-sync"
  );
  const { MetaInsightError } = await import(
    "../src/lib/social/providers/meta-insights"
  );
  const {
    buildSocialCredentialAad,
    encryptSocialTokenPayload,
    withMetaFacebookPageCredential,
  } = await import("../src/lib/social/security/social-crypto");

  const clientId = uuid();
  const brandId = uuid();
  const otherClientId = uuid();
  const otherBrandId = uuid();
  const profileId = uuid();
  const connectionId = uuid();
  const accountIds = Array.from({ length: 15 }, () => uuid());
  const selectedAccountId = accountIds[7]!;
  const pageExternalIds = accountIds.map((_, i) => `ext_page_${i}_${hex(4)}`);
  const selectedExternalId = pageExternalIds[7]!;

  const sensitiveMarkers = [
    "EAA",
    "access_token",
    selectedExternalId,
    "graph.facebook.com",
  ];

  async function check(
    id: number,
    name: string,
    fn: () => Promise<string>,
  ) {
    try {
      const evidence = await fn();
      record(id, name, "PASS", evidence);
    } catch (error) {
      record(
        id,
        name,
        "FAIL",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  try {
    // Ensure encryption key exists for local tests.
    if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
      process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
        "base64",
      );
    }

    await prisma.client.create({
      data: {
        id: clientId,
        name: `Step6 Client ${hex(3)}`,
        status: "active",
      },
    });
    await prisma.client.create({
      data: {
        id: otherClientId,
        name: `Step6 Other ${hex(3)}`,
        status: "active",
      },
    });

    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `step6_${hex(4)}@example.com`,
        displayName: "Step6 Owner",
        status: "active",
      },
    });

    await prisma.clientMembership.create({
      data: {
        clientId,
        profileId,
        role: "owner",
        status: "active",
      },
    });

    await prisma.businessBrand.create({
      data: {
        id: brandId,
        clientId,
        name: "Step6 Brand",
        status: "active",
        timezone: "America/Toronto",
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: otherBrandId,
        clientId: otherClientId,
        name: "Other Brand",
        status: "active",
      },
    });

    const tokenPayload = withMetaFacebookPageCredential(
      {
        accessToken: "SYNTH_USER_ACCESS_TOKEN",
        tokenType: "bearer",
        scopes: ["pages_show_list", "pages_read_engagement"],
      },
      {
        pageId: selectedExternalId,
        accessToken: "SYNTH_PAGE_ACCESS_TOKEN",
      },
    );

    const encrypted = encryptSocialTokenPayload(
      tokenPayload,
      buildSocialCredentialAad({
        clientId,
        connectionId,
        provider: "meta",
      }),
    );

    await prisma.socialProviderConnection.create({
      data: {
        id: connectionId,
        clientId,
        businessBrandId: brandId,
        provider: "meta",
        status: "connected",
        scopes: ["pages_show_list", "pages_read_engagement"],
        displayName: "Middle Selected Page",
        authorizedAt: new Date(),
        connectedAt: new Date(),
        createdByProfileId: profileId,
      },
    });

    await prisma.socialCredential.create({
      data: {
        clientId,
        connectionId,
        status: "active",
        encryptedPayload: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
      },
    });

    for (let i = 0; i < 15; i += 1) {
      await prisma.socialAccount.create({
        data: {
          id: accountIds[i],
          clientId,
          businessBrandId: i === 7 ? brandId : null,
          providerConnectionId: connectionId,
          platform: "facebook",
          accountType: "facebook_page",
          externalAccountId: pageExternalIds[i],
          displayName: `Page ${String(i).padStart(2, "0")}`,
          status: i === 7 ? "connected" : "not_connected",
          accessStatus: i === 7 ? "selected" : "available",
        },
      });
    }

    await prisma.socialBrandAccountAssignment.create({
      data: {
        clientId,
        businessBrandId: brandId,
        socialAccountId: selectedAccountId,
        status: "active",
        assignedByProfileId: profileId,
      },
    });

    const transportOk = {
      fetchJson: async (url: URL) => {
        if (url.pathname.includes("/insights")) {
          return {
            data: [
              {
                name: "page_impressions",
                values: [
                  { end_time: "2026-08-01T00:00:00+0000", value: 10 },
                  { end_time: "2026-08-02T00:00:00+0000", value: 20 },
                ],
              },
              {
                name: "page_impressions_unique",
                values: [
                  { end_time: "2026-08-01T00:00:00+0000", value: 7 },
                  { end_time: "2026-08-02T00:00:00+0000", value: 11 },
                ],
              },
              {
                name: "page_post_engagements",
                values: [
                  { end_time: "2026-08-01T00:00:00+0000", value: 3 },
                  { end_time: "2026-08-02T00:00:00+0000", value: 5 },
                ],
              },
            ],
          };
        }

        return {
          name: "Middle Selected Page",
          category: "Restaurant",
          fan_count: 42,
          timezone: "America/Toronto",
          picture: { data: { url: "https://cdn.example/page.png" } },
        };
      },
    };

    const transportEmpty = {
      fetchJson: async (url: URL) => {
        if (url.pathname.includes("/insights")) {
          return { data: [] };
        }
        return {
          name: "Middle Selected Page",
          category: "Restaurant",
          fan_count: 0,
          timezone: "America/Toronto",
          picture: { data: { url: "https://cdn.example/page.png" } },
        };
      },
    };

    let insightCalls = 0;
    const transportPartial = {
      fetchJson: async (url: URL) => {
        if (url.pathname.includes("/insights")) {
          insightCalls += 1;
          if (insightCalls === 1) {
            return {
              data: [
                {
                  name: "page_impressions",
                  values: [
                    { end_time: "2026-08-01T00:00:00+0000", value: 9 },
                  ],
                },
              ],
              paging: {
                cursors: { after: "CURSOR_1" },
                next: "https://graph.facebook.com/v21.0/x/insights?after=CURSOR_1",
              },
            };
          }
          throw new MetaInsightError(
            "temporary",
            "Facebook Page sync failed temporarily. You can retry.",
          );
        }
        return {
          name: "Middle Selected Page",
          category: "Restaurant",
          fan_count: 42,
          timezone: "America/Toronto",
          picture: { data: { url: "https://cdn.example/page.png" } },
        };
      },
    };

    await check(1, "Successful initial sync", async () => {
      resetFacebookPageSyncCoalescingForTests();
      const t0 = Date.now();
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportOk,
      });
      const ms = Date.now() - t0;
      assert(sync.status === "ready", "ready");
      assert(sync.pageName === "Middle Selected Page", "page name");
      assert(sync.metricsAvailable, "metrics");
      assert(sync.timezone === "America/Toronto", "tz");
      const rows = await listSelectedFacebookPageMetrics({
        clientId,
        businessBrandId: brandId,
        socialAccountId: selectedAccountId,
      });
      assert(rows.length === 2, "two days");
      return `ready; days=${rows.length}; ms=${ms}`;
    });

    await check(2, "Duplicate job delivery is idempotent", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportOk,
      });
      await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportOk,
      });
      const count = await prisma.socialAnalyticsDaily.count({
        where: {
          clientId,
          socialAccountId: selectedAccountId,
          source: "provider_api",
        },
      });
      assert(count === 2, "no duplicate days");
      return `days=${count}`;
    });

    await check(3, "Concurrent sync requests coalesce", async () => {
      resetFacebookPageSyncCoalescingForTests();
      const [a, b] = await Promise.all([
        runInitialFacebookPageSync({
          clientId,
          profileId,
          connectionId,
          socialAccountId: selectedAccountId,
          transport: transportOk,
        }),
        runInitialFacebookPageSync({
          clientId,
          profileId,
          connectionId,
          socialAccountId: selectedAccountId,
          transport: transportOk,
        }),
      ]);
      assert(a.status === "ready" && b.status === "ready", "both ready");
      return "coalesced ready";
    });

    await check(4, "Valid connection with no available data → empty", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAnalyticsDaily.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportEmpty,
      });
      assert(sync.status === "empty", "empty");
      assert(!sync.metricsAvailable, "no metrics");
      return "empty";
    });

    await check(5, "Partial pagination failure → degraded + resume cursor", async () => {
      resetFacebookPageSyncCoalescingForTests();
      insightCalls = 0;
      await prisma.socialAnalyticsDaily.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportPartial,
      });
      assert(sync.status === "degraded", "degraded");
      assert(sync.partialData, "partial");
      const state = await prisma.socialAccountSyncState.findUnique({
        where: { socialAccountId: selectedAccountId },
        select: { syncCursor: true },
      });
      assert(state?.syncCursor === "CURSOR_1", "cursor");
      return "degraded+cursor";
    });

    await check(6, "Rate limiting / transient retry succeeds", async () => {
      resetFacebookPageSyncCoalescingForTests();
      let attempts = 0;
      const transport = {
        fetchJson: async (url: URL) => {
          if (url.pathname.includes("/insights")) {
            attempts += 1;
            if (attempts < 3) {
              throw new MetaInsightError(
                "rate_limited",
                "Facebook rate-limited analytics sync. Wait a moment and retry.",
              );
            }
            return transportOk.fetchJson(url);
          }
          return transportOk.fetchJson(url);
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
      });
      assert(sync.status === "ready", "ready after retry");
      assert(attempts === 3, "retried");
      return `attempts=${attempts}`;
    });

    await check(7, "Expired credential → action_required", async () => {
      resetFacebookPageSyncCoalescingForTests();
      const transport = {
        fetchJson: async () => {
          throw new MetaInsightError(
            "authorization_expired",
            "Facebook authorization expired. Reconnect to continue.",
          );
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
      });
      assert(sync.status === "action_required", "action_required");
      assert(sync.lastErrorCategory === "authorization_expired", "category");
      return "action_required";
    });

    await check(8, "Missing permission → action_required", async () => {
      resetFacebookPageSyncCoalescingForTests();
      const transport = {
        fetchJson: async () => {
          throw new MetaInsightError(
            "permission_required",
            "Facebook Page permissions are missing for analytics sync.",
          );
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
      });
      assert(sync.status === "action_required", "action_required");
      return sync.lastErrorCategory ?? "missing";
    });

    await check(9, "Page access changed after selection → action_required", async () => {
      resetFacebookPageSyncCoalescingForTests();
      const transport = {
        fetchJson: async () => {
          throw new MetaInsightError(
            "not_found",
            "The selected Facebook Page is no longer available through this authorization.",
          );
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
      });
      assert(sync.status === "action_required", "action_required");
      return "page access lost";
    });

    await check(10, "Fifteen discovered Pages with middle Page selected", async () => {
      const snap = await getSelectedFacebookPageSyncSnapshot({
        clientId,
        businessBrandId: brandId,
      });
      assert(snap?.socialAccountId === selectedAccountId, "middle id");
      assert(snap?.pageName === "Middle Selected Page", "middle name");
      assert(selectedAccountId === accountIds[7], "index 7");
      assert(selectedAccountId !== accountIds[0], "not first discovered slot");
      return "middle selected";
    });

    await check(11, "Page changed while sync running → action_required", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAccount.update({
        where: { id: selectedAccountId },
        data: {
          accessStatus: "selected",
          status: "connected",
          businessBrandId: brandId,
        },
      });
      await prisma.socialProviderConnection.update({
        where: { id: connectionId },
        data: { status: "connected" },
      });
      const transport = {
        fetchJson: async (url: URL) => {
          if (!url.pathname.includes("/insights")) {
            await prisma.socialAccount.update({
              where: { id: selectedAccountId },
              data: { accessStatus: "available", status: "not_connected" },
            });
            return transportOk.fetchJson(url);
          }
          return transportOk.fetchJson(url);
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
      });
      assert(sync.status === "action_required", "action_required");
      await prisma.socialAccount.update({
        where: { id: selectedAccountId },
        data: {
          accessStatus: "selected",
          status: "connected",
          businessBrandId: brandId,
          displayName: "Middle Selected Page",
        },
      });
      return sync.lastErrorCategory ?? "page_changed";
    });

    await check(12, "Disconnect while syncing → action_required", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAccount.update({
        where: { id: selectedAccountId },
        data: {
          accessStatus: "selected",
          status: "connected",
          businessBrandId: brandId,
        },
      });
      await prisma.socialProviderConnection.update({
        where: { id: connectionId },
        data: { status: "connected" },
      });
      const transport = {
        fetchJson: async (url: URL) => {
          if (!url.pathname.includes("/insights")) {
            await prisma.socialProviderConnection.update({
              where: { id: connectionId },
              data: { status: "disconnected" },
            });
            return transportOk.fetchJson(url);
          }
          return transportOk.fetchJson(url);
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
      });
      assert(sync.status === "action_required", "action_required");
      await prisma.socialProviderConnection.update({
        where: { id: connectionId },
        data: { status: "connected" },
      });
      await prisma.socialAccount.update({
        where: { id: selectedAccountId },
        data: {
          accessStatus: "selected",
          status: "connected",
          businessBrandId: brandId,
        },
      });
      return sync.lastErrorCategory ?? "disconnected";
    });

    await check(13, "Workspace isolation", async () => {
      const foreign = await getSelectedFacebookPageSyncSnapshot({
        clientId: otherClientId,
        businessBrandId: otherBrandId,
      });
      assert(foreign === null, "no foreign snapshot");
      return "isolated";
    });

    await check(14, "Reload/server restart persistence", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportOk,
      });
      resetFacebookPageSyncCoalescingForTests();
      const snap = await getSelectedFacebookPageSyncSnapshot({
        clientId,
        businessBrandId: brandId,
      });
      assert(snap?.status === "ready", "persisted ready");
      assert(snap?.metricsAvailable, "persisted metrics");
      return "persisted";
    });

    await check(15, "UI/API source guards for sync states + no fabricated zeros", async () => {
      const dash = readSource(
        "src/components/social/platforms/facebook-page-sync-dashboard.tsx",
      );
      const route = readSource(
        "src/app/api/social/connections/[connectionId]/sync/route.ts",
      );
      const syncSrc = readSource(
        "src/lib/social/sync/facebook-page-initial-sync.ts",
      );
      assert(dash.includes("Synchronizing Page identity"), "syncing UI");
      assert(dash.includes("No data available for this period"), "empty UI");
      assert(dash.includes("does not invent zero metrics"), "no fake zeros");
      assert(dash.includes("Analytics unavailable"), "failed UI");
      assert(dash.includes("statusLabel"), "explicit status");
      assert(dash.includes('unavailable || value === null ? "—"') || dash.includes('!confirmed || value === null ? "—"'), "dash missing");
      assert(route.includes("enqueueInitialFacebookPageSync"), "post enqueues");
      assert(route.includes("dataProvenance"), "provenance");
      assert(!route.includes("runInitialFacebookPageSync"), "post does not await Meta");
      assert(!route.includes("externalAccountId"), "no page id in route response");
      assert(
        !syncSrc.includes('runSocialDbTransaction(\n    "facebook-page-sync-mark"'),
        "claim avoids interactive mark TX",
      );
      assert(syncSrc.includes("claimFacebookPageSync"), "claim helper");
      assert(syncSrc.includes("syncGeneration"), "generation ownership");
      return "ui+api+claim guards";
    });

    await check(16, "Enqueue after selection claims without awaiting Meta", async () => {
      const service = readSource(
        "src/lib/social/connections/social-facebook-page-service.ts",
      );
      const jobSrc = readSource(
        "src/lib/social/sync/facebook-page-sync-job.ts",
      );
      const cronSrc = readSource(
        "src/app/api/cron/social-sync-jobs/route.ts",
      );
      assert(service.includes("enqueueInitialFacebookPageSync"), "enqueue");
      assert(jobSrc.includes("scheduleFacebookPageSyncJob"), "after schedule");
      assert(jobSrc.includes("after_optimization"), "after is optimization");
      assert(jobSrc.includes("claimAndEnqueueFacebookPageSync"), "outbox");
      assert(jobSrc.includes("claimFacebookPageSyncJobLease"), "lease claim");
      assert(jobSrc.includes("runFacebookPageSyncWorkerTick"), "worker tick");
      assert(cronSrc.includes("runFacebookPageSyncWorkerTick"), "cron route");
      assert(existsSync(resolve(process.cwd(), "vercel.json")), "vercel cron");
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAccountSyncState.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });
      await prisma.job.deleteMany({
        where: { clientId, type: "sync_analytics" },
      });
      const t0 = Date.now();
      const snap = await enqueueInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        businessBrandId: brandId,
      });
      const ms = Date.now() - t0;
      assert(snap, "snapshot");
      assert(snap?.status === "syncing", "claimed syncing");
      assert(ms < 8000, `enqueue returned promptly (${ms}ms)`);
      const job = await prisma.job.findFirst({
        where: { clientId, type: "sync_analytics", status: "queued" },
        select: { id: true, status: true },
      });
      assert(job, "durable job queued");
      const state = await prisma.socialAccountSyncState.findUnique({
        where: { socialAccountId: selectedAccountId },
        select: { dispatchJobId: true, syncGeneration: true },
      });
      assert(state?.dispatchJobId === job?.id, "outbox linked");
      return `status=${snap?.status}; ms=${ms}; job=${job?.status}`;
    });

    await check(17, "Sync claim is short CAS without long work inside TX", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAccountSyncState.updateMany({
        where: { socialAccountId: selectedAccountId },
        data: { status: "ready" },
      });
      const t0 = Date.now();
      const claim = await claimFacebookPageSync({
        clientId,
        businessBrandId: brandId,
        socialAccountId: selectedAccountId,
        connectionId,
        rangeStart: "2026-07-01",
        rangeEnd: "2026-07-28",
        timezone: "UTC",
        resumeCursor: null,
      });
      const ms = Date.now() - t0;
      assert(claim.claimed, "claimed");
      assert(claim.generation >= 1, "generation");
      assert(ms < 2000, `claim ms=${ms}`);
      // Release so later tests can proceed.
      await prisma.socialAccountSyncState.updateMany({
        where: { socialAccountId: selectedAccountId },
        data: { status: "ready" },
      });
      return `generation=${claim.generation}; ms=${ms}`;
    });

    await check(18, "Successful zero is distinguishable from missing metrics", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAnalyticsDaily.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });
      const transportZero = {
        fetchJson: async (url: URL) => {
          if (url.pathname.includes("/insights")) {
            return {
              data: [
                {
                  name: "page_impressions",
                  values: [
                    { end_time: "2026-08-01T00:00:00+0000", value: 0 },
                  ],
                },
                {
                  name: "page_impressions_unique",
                  values: [
                    { end_time: "2026-08-01T00:00:00+0000", value: 0 },
                  ],
                },
                {
                  name: "page_post_engagements",
                  values: [
                    { end_time: "2026-08-01T00:00:00+0000", value: 0 },
                  ],
                },
              ],
            };
          }
          return {
            name: "Middle Selected Page",
            category: "Restaurant",
            fan_count: 0,
            timezone: "America/Toronto",
            picture: { data: { url: "https://cdn.example/page.png" } },
          };
        },
      };
      const sync = await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportZero,
      });
      assert(sync.status === "ready", "ready with zeros");
      assert(sync.metricsAvailable, "rows exist");
      const rows = await listSelectedFacebookPageMetrics({
        clientId,
        businessBrandId: brandId,
        socialAccountId: selectedAccountId,
      });
      assert(rows.length === 1, "one day");
      assert(rows[0]?.reach === 0, "actual zero reach");
      assert(rows[0]?.impressions === 0, "actual zero impressions");
      const idleSnap = await getSelectedFacebookPageSyncSnapshot({
        clientId,
        businessBrandId: brandId,
      });
      assert(idleSnap?.metricsAvailable === true, "available after success");
      return "zero≠missing";
    });

    await check(19, "Stale generation cannot overwrite newer claim", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAccountSyncState.updateMany({
        where: { socialAccountId: selectedAccountId },
        data: { status: "ready", syncGeneration: 10 },
      });

      const claim = await claimFacebookPageSync({
        clientId,
        businessBrandId: brandId,
        socialAccountId: selectedAccountId,
        connectionId,
        rangeStart: "2026-07-01",
        rangeEnd: "2026-07-28",
        timezone: "UTC",
        resumeCursor: null,
      });
      assert(claim.claimed, "first claim");
      const staleGeneration = claim.generation;

      // Newer claim bumps generation while stale job still "running".
      await prisma.socialAccountSyncState.updateMany({
        where: { socialAccountId: selectedAccountId },
        data: { status: "ready" },
      });
      const newer = await claimFacebookPageSync({
        clientId,
        businessBrandId: brandId,
        socialAccountId: selectedAccountId,
        connectionId,
        rangeStart: "2026-07-01",
        rangeEnd: "2026-07-28",
        timezone: "UTC",
        resumeCursor: null,
      });
      assert(newer.claimed, "newer claim");
      assert(newer.generation > staleGeneration, "bumped");

      // Stale job finishes Meta and attempts finalize with old generation.
      resetFacebookPageSyncCoalescingForTests();
      await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport: transportOk,
        claimedGeneration: staleGeneration,
        claimedCursor: null,
      });

      const state = await prisma.socialAccountSyncState.findUnique({
        where: { socialAccountId: selectedAccountId },
        select: { syncGeneration: true, status: true },
      });
      assert(state?.syncGeneration === newer.generation, "generation kept");
      assert(state?.status === "syncing", "newer still owns syncing");
      await prisma.socialAccountSyncState.updateMany({
        where: { socialAccountId: selectedAccountId },
        data: { status: "ready" },
      });
      return `stale=${staleGeneration}; live=${newer.generation}`;
    });

    await check(20, "Brand selector / dashboard must not await Meta sync", async () => {
      const route = readSource(
        "src/app/api/social/connections/[connectionId]/sync/route.ts",
      );
      const brandRoute = readSource(
        "src/app/api/social/brand-selector/route.ts",
      );
      const brandCtx = readSource("src/lib/security/brand-context.ts");
      assert(route.includes("enqueueInitialFacebookPageSync"), "async enqueue");
      assert(route.includes("releaseExpiredFacebookPageSyncLeases"), "lease release only");
      assert(!route.includes("runFacebookPageSyncWorkerTick"), "no Meta on GET");
      assert(!brandRoute.includes("runInitialFacebookPageSync"), "no sync in brand");
      assert(!brandCtx.includes("runInitialFacebookPageSync"), "no sync in ctx");
      assert(!brandCtx.includes("fetchFacebookPageInsights"), "no Meta in brand");
      assert(brandCtx.includes("$queryRaw"), "single canonical query");
      assert(brandCtx.includes("invalidateBrandSelectorCache"), "cache invalidate");
      return "decoupled";
    });

    await check(21, "Death before after(); cron worker delivers without GET", async () => {
      const {
        runFacebookPageSyncWorkerTick,
      } = await import("../src/lib/social/sync/facebook-page-sync-job");

      resetFacebookPageSyncCoalescingForTests();
      await prisma.job.deleteMany({
        where: { clientId, type: "sync_analytics" },
      });
      await prisma.socialAccountSyncState.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });

      // Simulate: HTTP claim+enqueue then process dies before after() runs.
      const snap = await enqueueInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        businessBrandId: brandId,
      });
      assert(snap?.status === "syncing", "left syncing");

      const job = await prisma.job.findFirst({
        where: { clientId, type: "sync_analytics", status: "queued" },
        select: { id: true },
      });
      assert(job, "job remains queued");

      // Independent worker tick — no dashboard GET.
      const tick = await runFacebookPageSyncWorkerTick({
        clientId,
        processJobs: true,
        transport: transportOk,
      });
      assert(tick.claimed >= 1, "worker claimed");
      const after = await getSelectedFacebookPageSyncSnapshot({
        clientId,
        businessBrandId: brandId,
      });
      assert(after?.status === "ready", "completed via cron tick");
      return `claimed=${tick.claimed}; status=${after?.status}`;
    });

    await check(22, "Death after lease claim; expired lease recovered by tick", async () => {
      const {
        claimFacebookPageSyncJobLease,
        runFacebookPageSyncWorkerTick,
      } = await import("../src/lib/social/sync/facebook-page-sync-job");

      resetFacebookPageSyncCoalescingForTests();
      await prisma.job.deleteMany({
        where: { clientId, type: "sync_analytics" },
      });
      await prisma.socialAccountSyncState.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });

      await enqueueInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        businessBrandId: brandId,
      });

      const job = await prisma.job.findFirst({
        where: { clientId, type: "sync_analytics", status: "queued" },
        select: { id: true },
      });
      assert(job, "queued");

      const lease = await claimFacebookPageSyncJobLease(job!.id, {
        leaseOwner: "11111111-1111-4111-8111-111111111111",
        leaseMs: 1,
      });
      assert(lease, "lease claimed");

      // Simulate process death holding the lease.
      await prisma.job.update({
        where: { id: job!.id },
        data: {
          leaseExpiresAt: new Date(Date.now() - 1_000),
        },
      });

      const released = await runFacebookPageSyncWorkerTick({
        clientId,
        processJobs: false,
      });
      assert(released.released >= 1, "lease released to retrying");

      // Due now (backoff would otherwise delay); cron would pick this up next minute.
      await prisma.job.updateMany({
        where: { id: job!.id, status: "retrying" },
        data: { scheduledFor: new Date(Date.now() - 1_000) },
      });

      const tick = await runFacebookPageSyncWorkerTick({
        clientId,
        processJobs: true,
        transport: transportOk,
      });
      assert(tick.claimed >= 1, "worker reclaimed");
      const final = await getSelectedFacebookPageSyncSnapshot({
        clientId,
        businessBrandId: brandId,
      });
      assert(final?.status === "ready", "ready after recovery");
      return `released=${released.released}; claimed=${tick.claimed}`;
    });

    await check(23, "Death during pagination cannot write after generation bump", async () => {
      resetFacebookPageSyncCoalescingForTests();
      await prisma.socialAnalyticsDaily.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });

      let advanced = false;
      const transport = {
        fetchJson: async (url: URL) => {
          if (url.pathname.includes("/insights") && !advanced) {
            advanced = true;
            // Newer sync generation wins mid-flight.
            await prisma.socialAccountSyncState.updateMany({
              where: { socialAccountId: selectedAccountId },
              data: {
                syncGeneration: { increment: 1 },
                status: "syncing",
              },
            });
          }
          return transportOk.fetchJson(url);
        },
      };

      const before = await prisma.socialAccountSyncState.findUnique({
        where: { socialAccountId: selectedAccountId },
        select: { syncGeneration: true },
      });

      await runInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        transport,
        claimedGeneration: before?.syncGeneration ?? 1,
        claimedCursor: null,
      });

      const metrics = await prisma.socialAnalyticsDaily.count({
        where: {
          socialAccountId: selectedAccountId,
          source: "provider_api",
        },
      });
      // Stale generation must not persist metrics after bump mid-pagination.
      assert(metrics === 0, "no stale metric writes");
      return "stale pagination blocked";
    });

    await check(24, "Death during finalization: lease owner required", async () => {
      const {
        claimFacebookPageSyncJobLease,
        extendFacebookPageSyncJobLease,
      } = await import("../src/lib/social/sync/facebook-page-sync-job");

      resetFacebookPageSyncCoalescingForTests();
      await prisma.job.deleteMany({
        where: { clientId, type: "sync_analytics" },
      });
      await prisma.socialAccountSyncState.deleteMany({
        where: { socialAccountId: selectedAccountId },
      });

      await enqueueInitialFacebookPageSync({
        clientId,
        profileId,
        connectionId,
        socialAccountId: selectedAccountId,
        businessBrandId: brandId,
      });
      const job = await prisma.job.findFirst({
        where: { clientId, type: "sync_analytics", status: "queued" },
        select: { id: true },
      });
      const lease = await claimFacebookPageSyncJobLease(job!.id);
      assert(lease, "leased");

      // Another worker steals expired lease.
      await prisma.job.update({
        where: { id: job!.id },
        data: { leaseExpiresAt: new Date(Date.now() - 5_000) },
      });
      const stolen = await claimFacebookPageSyncJobLease(job!.id, {
        leaseOwner: "22222222-2222-4222-8222-222222222222",
      });
      assert(stolen, "stolen after expiry");

      const extended = await extendFacebookPageSyncJobLease({
        jobId: job!.id,
        leaseOwner: lease!.leaseOwner,
      });
      assert(!extended, "old owner cannot extend");
      return "lease ownership enforced";
    });

    await check(25, "Exponential backoff bounded", async () => {
      const { computeFacebookSyncBackoffMs, FACEBOOK_SYNC_BACKOFF_MAX_MS } =
        await import("../src/lib/social/sync/facebook-page-sync-job");
      const a1 = computeFacebookSyncBackoffMs(1);
      const a5 = computeFacebookSyncBackoffMs(5);
      const a20 = computeFacebookSyncBackoffMs(20);
      assert(a1 >= 5_000, "base");
      assert(a5 > a1, "grows");
      assert(a20 <= FACEBOOK_SYNC_BACKOFF_MAX_MS * 1.2, "capped");
      return `a1=${a1}; a20=${a20}`;
    });

    await check(26, "No sensitive identifiers in captured logs", async () => {
      const joined = captureLog.join("\n");
      for (const marker of sensitiveMarkers) {
        assert(!joined.includes(marker), `leaked ${marker}`);
      }
      assert(!joined.includes("SYNTH_PAGE_ACCESS_TOKEN"), "page token");
      assert(!joined.includes("SYNTH_USER_ACCESS_TOKEN"), "user token");
      return "log scan clean";
    });

    await check(99, "Suite harness", async () => "ok");
  } finally {
    await prisma.job.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.socialAnalyticsDaily.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.socialAccountSyncState.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.socialBrandAccountAssignment.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.socialCredential.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.socialAccount.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.socialProviderConnection.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.clientMembership.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.businessBrand.deleteMany({
      where: { clientId: { in: [clientId, otherClientId] } },
    });
    await prisma.profile.deleteMany({ where: { id: profileId } }).catch(() => undefined);
    await prisma.client.deleteMany({
      where: { id: { in: [clientId, otherClientId] } },
    });
    await prisma.$disconnect();
    restoreLogs();
  }

  console.log("\n=== Step 6 Facebook Page Initial Sync ===");
  for (const result of results) {
    console.log(
      `[${result.status}] #${result.id} ${result.name} — ${result.evidence}`,
    );
  }
  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  console.log(
    `\nSummary: ${passed} passed, ${failed} failed, ${blocked} blocked`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  restoreLogs();
  console.error(error);
  process.exit(1);
});
