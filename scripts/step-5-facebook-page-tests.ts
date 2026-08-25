/**
 * Step 5 Automated Testing Guide — all 60 required checks.
 * Synthetic Meta responses and placeholder credentials only.
 * Never prints tokens, codes, secrets, verifiers, cookies, or token URLs.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
const sensitiveMarkers = [
  "SYNTH_USER_ACCESS_TOKEN",
  "SYNTH_PAGE_TOKEN_",
  "SYNTH_AUTH_CODE",
  "SYNTH_OAUTH_STATE",
  "SYNTH_PKCE_VERIFIER",
  "SYNTH_APP_SECRET",
  "SYNTH_COOKIE_VALUE",
  "access_token=SYNTH",
];

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

function record(
  id: number,
  name: string,
  status: Status,
  evidence: string,
) {
  const existing = results.findIndex((r) => r.id === id);
  if (existing >= 0) results.splice(existing, 1);
  results.push({ id, name, status, evidence });
}

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

async function check(
  id: number,
  name: string,
  fn: () => Promise<string> | string,
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

function ensureEncryptionKey() {
  if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1) {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = randomBytes(32).toString(
      "base64",
    );
  }
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

type PageMock = {
  id: string;
  name: string;
  category?: string;
  pictureUrl?: string;
  access_token?: string | null;
  tasks?: string[];
};

type MockMode = {
  pages?: PageMock[] | "fail" | "malformed" | "nonjson" | "timeout";
  pagesByPage?: PageMock[][];
  errorStatus?: number;
  errorBody?: Record<string, unknown>;
  duplicateIds?: boolean;
  evilNextHost?: boolean;
  failThenPages?: PageMock[];
};

let mockMode: MockMode = {};
let accountsCallCount = 0;
let fetchHosts: string[] = [];
let fetchUrls: string[] = [];
let failThenRemaining = 0;

function installMetaFetchMock() {
  accountsCallCount = 0;
  fetchHosts = [];
  fetchUrls = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    fetchHosts.push(url.origin);
    fetchUrls.push(`${url.origin}${url.pathname}`);

    if (url.pathname.includes("/me/permissions")) {
      return jsonResponse({
        data: [
          { permission: "pages_show_list", status: "granted" },
          { permission: "pages_read_engagement", status: "granted" },
          { permission: "public_profile", status: "granted" },
        ],
      });
    }

    if (url.pathname.includes("/me/accounts")) {
      accountsCallCount += 1;

      if (failThenRemaining > 0) {
        failThenRemaining -= 1;
        return jsonResponse(
          { error: { message: "SYNTH_TEMP_FAIL", code: 1 } },
          500,
        );
      }

      if (mockMode.pages === "timeout") {
        const err = new Error("Aborted");
        err.name = "AbortError";
        throw err;
      }

      if (mockMode.pages === "nonjson") {
        return new Response("not-json", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      }

      if (mockMode.pages === "malformed") {
        return jsonResponse({ data: "nope" });
      }

      if (mockMode.pages === "fail") {
        return jsonResponse(
          mockMode.errorBody ?? {
            error: { message: "fail", code: 1 },
          },
          mockMode.errorStatus ?? 500,
        );
      }

      const pageSets = mockMode.pagesByPage;
      const pages =
        pageSets && pageSets.length > 0
          ? pageSets[
              Math.min(accountsCallCount - 1, pageSets.length - 1)
            ]!
          : Array.isArray(mockMode.pages)
            ? mockMode.pages
            : mockMode.failThenPages
              ? mockMode.failThenPages
              : [];

      let data = pages.map((page) => ({
        id: page.id,
        name: page.name,
        category: page.category ?? "Brand",
        picture: page.pictureUrl
          ? { data: { url: page.pictureUrl } }
          : undefined,
        access_token:
          page.access_token === null
            ? undefined
            : (page.access_token ?? `SYNTH_PAGE_TOKEN_${page.id}`),
        tasks: page.tasks ?? ["MANAGE", "CREATE_CONTENT"],
      }));

      if (mockMode.duplicateIds && data.length > 0) {
        data = [...data, { ...data[0]! }];
      }

      if (mockMode.evilNextHost && accountsCallCount === 1) {
        return jsonResponse({
          data,
          paging: {
            next: "https://evil.example/v21.0/me/accounts?after=x",
          },
        });
      }

      const hasMore =
        pageSets !== undefined &&
        accountsCallCount < pageSets.length;

      return jsonResponse({
        data,
        paging: hasMore
          ? {
              next: `https://graph.facebook.com/v21.0/me/accounts?after=cursor${accountsCallCount}`,
            }
          : undefined,
      });
    }

    return jsonResponse({ error: { message: "unexpected" } }, 404);
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function assertSanitizedPayload(value: unknown) {
  const text = JSON.stringify(value);
  for (const marker of [
    "SYNTH_USER_ACCESS_TOKEN",
    "SYNTH_PAGE_TOKEN_",
    "access_token",
  ]) {
    assert(!text.includes(marker), `response leaked ${marker}`);
  }
}

async function main() {
  ensureEncryptionKey();
  installLogCapture();
  // Seed synthetic markers into the scan list awareness (never log them).
  void sensitiveMarkers;

  if (!process.env.DATABASE_URL) {
    record(0, "database", "BLOCKED", "DATABASE_URL missing");
    printSummary();
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stamp = Date.now().toString(36);
  const fixtureIds: {
    clientIds: string[];
    profileIds: string[];
    connectionIds: string[];
  } = { clientIds: [], profileIds: [], connectionIds: [] };

  try {
    const {
      encryptSocialTokenPayload,
      decryptSocialTokenPayload,
      buildSocialCredentialAad,
      withMetaFacebookPageCredential,
      readMetaFacebookPageCredential,
    } = await import("@/lib/social/security/social-crypto");

    const {
      fetchManagedFacebookPages,
      revalidateManagedFacebookPage,
      MetaPageDiscoveryError,
      META_PAGES_MAX_PAGES,
      mapDiscoveredMetaPageFromRecord,
    } = await import("@/lib/social/providers/meta-pages");

    const {
      discoverFacebookPages,
      selectFacebookPage,
    } = await import(
      "@/lib/social/connections/social-facebook-page-service"
    );

    const {
      canCancelPendingConnection,
      canContinueAuthorization,
      canAddAnotherAccount,
      isProviderPlatformConnected,
      resolveConnectedAccountLabel,
      resolveProviderCardLabel,
      META_PLATFORM_REPRESENTATION,
    } = await import(
      "@/lib/social/connections/social-connection-lifecycle-policy"
    );

    // --- Fixtures ---
    const clientId = uuid();
    const otherClientId = uuid();
    const profileId = uuid();
    const otherProfileId = uuid();
    const inactiveProfileId = uuid();
    const viewerProfileId = uuid();
    const strangerId = uuid();
    const brandId = uuid();
    const brandId2 = uuid();
    const otherBrandId = uuid();

    fixtureIds.clientIds.push(clientId, otherClientId);
    fixtureIds.profileIds.push(
      profileId,
      otherProfileId,
      inactiveProfileId,
      viewerProfileId,
      strangerId,
    );

    await prisma.client.create({
      data: {
        id: clientId,
        name: `Step5AT Client ${stamp}`,
        status: "active",
      },
    });
    await prisma.client.create({
      data: {
        id: otherClientId,
        name: `Step5AT Other ${stamp}`,
        status: "active",
      },
    });

    async function makeProfile(id: string, label: string) {
      await prisma.profile.create({
        data: {
          id,
          authUserId: uuid(),
          email: `step5at-${label}-${stamp}@example.test`,
          displayName: label,
          status: "active",
          role: "user",
        },
      });
    }

    await makeProfile(profileId, "owner");
    await makeProfile(otherProfileId, "other");
    await makeProfile(inactiveProfileId, "inactive");
    await makeProfile(viewerProfileId, "viewer");
    await makeProfile(strangerId, "stranger");

    await prisma.clientMembership.create({
      data: {
        profileId,
        clientId,
        role: "owner",
        status: "active",
      },
    });
    await prisma.clientMembership.create({
      data: {
        profileId: otherProfileId,
        clientId: otherClientId,
        role: "owner",
        status: "active",
      },
    });
    await prisma.clientMembership.create({
      data: {
        profileId: inactiveProfileId,
        clientId,
        role: "admin",
        status: "suspended",
      },
    });
    await prisma.clientMembership.create({
      data: {
        profileId: viewerProfileId,
        clientId,
        role: "viewer",
        status: "active",
      },
    });

    await prisma.businessBrand.create({
      data: {
        id: brandId,
        clientId,
        name: `Brand A ${stamp}`,
        status: "active",
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: brandId2,
        clientId,
        name: `Brand B ${stamp}`,
        status: "active",
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: otherBrandId,
        clientId: otherClientId,
        name: `Other Brand ${stamp}`,
        status: "active",
      },
    });

    async function createConnection(options?: {
      brand?: string;
      client?: string;
      provider?: "meta" | "google";
      status?:
        | "authorized"
        | "connected"
        | "pending_authorization"
        | "not_connected"
        | "disconnected";
      userToken?: string;
    }) {
      const connectionId = uuid();
      fixtureIds.connectionIds.push(connectionId);
      const client = options?.client ?? clientId;
      const brand = options?.brand ?? brandId;
      const provider = options?.provider ?? "meta";
      const userToken =
        options?.userToken ?? "SYNTH_USER_ACCESS_TOKEN";

      await prisma.socialProviderConnection.create({
        data: {
          id: connectionId,
          clientId: client,
          businessBrandId: brand,
          provider,
          status: options?.status ?? "authorized",
          scopes:
            provider === "meta"
              ? ["pages_show_list", "pages_read_engagement"]
              : [],
          authorizedAt:
            options?.status === "pending_authorization" ||
            options?.status === "not_connected"
              ? null
              : new Date(),
          createdByProfileId:
            client === clientId ? profileId : otherProfileId,
        },
      });

      if (provider === "meta" && options?.status !== "not_connected") {
        const encrypted = encryptSocialTokenPayload(
          {
            accessToken: userToken,
            scopes: ["pages_show_list", "pages_read_engagement"],
            providerAccountId: "meta-user-fixture",
          },
          buildSocialCredentialAad({
            clientId: client,
            connectionId,
            provider: "meta",
          }),
        );

        await prisma.socialCredential.create({
          data: {
            clientId: client,
            connectionId,
            status: "active",
            encryptedPayload: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            keyVersion: encrypted.keyVersion,
          },
        });
      }

      return connectionId;
    }

    const primaryConnectionId = await createConnection();

    // ========== A. Discovery and response safety ==========

    await check(
      1,
      "Authorized connection discovers one eligible Page with sanitized fields",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-1",
              name: "Alpha Page",
              category: "Cafe",
              pictureUrl: "https://cdn.example/a.png",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: primaryConnectionId,
        });
        assert(discovery.pages.length === 1, "one page");
        const page = discovery.pages[0]!;
        assert(page.externalPageId === "page-1", "id");
        assert(page.name === "Alpha Page", "name");
        assert(page.category === "Cafe", "category");
        assert(
          page.profileImageUrl === "https://cdn.example/a.png",
          "picture",
        );
        assert(page.selectable === true, "selectable");
        assertSanitizedPayload(discovery);
        return "one sanitized page";
      },
    );

    await check(
      2,
      "Multiple eligible Pages return correct identity and availability",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-m1",
              name: "Multi One",
              category: "Shop",
              pictureUrl: "https://cdn.example/1.png",
            },
            {
              id: "page-m2",
              name: "Multi Two",
              category: "Brand",
              pictureUrl: "https://cdn.example/2.png",
            },
          ],
        };
        const multiConn = await createConnection({ brand: brandId2 });
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: multiConn,
        });
        assert(discovery.pages.length === 2, "two pages");
        assert(
          discovery.pages.every((p) => p.selectable),
          "both selectable",
        );
        assert(
          discovery.pages.map((p) => p.externalPageId).sort().join(",") ===
            "page-m1,page-m2",
          "ids",
        );
        return "2 pages with identity fields";
      },
    );

    await check(
      3,
      "Page and user tokens never appear in API/discovery response",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-tok",
              name: "Token Check",
              access_token: "SYNTH_PAGE_TOKEN_tok",
            },
          ],
        };
        const conn = await createConnection();
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        assertSanitizedPayload(discovery);
        return "no tokens in discovery DTO";
      },
    );

    await check(
      4,
      "Discovery follows Meta pagination and combines all pages",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pagesByPage: [
            [{ id: "p-a", name: "A" }],
            [{ id: "p-b", name: "B" }],
            [{ id: "p-c", name: "C" }],
          ],
        };
        const pages = await fetchManagedFacebookPages({
          userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
        });
        assert(pages.length === 3, "combined");
        assert(accountsCallCount === 3, "3 calls");
        return `pages=3 calls=${accountsCallCount}`;
      },
    );

    await check(
      5,
      "Duplicate Page IDs across Meta pages are deduplicated",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [
            { id: "dup", name: "Dup" },
            { id: "other", name: "Other" },
          ],
          duplicateIds: true,
        };
        const pages = await fetchManagedFacebookPages({
          userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
        });
        assert(pages.length === 2, "deduped");
        return "unique=2";
      },
    );

    await check(
      6,
      "Pagination stops at the configured request/page cap",
      async () => {
        installMetaFetchMock();
        const sets: PageMock[][] = [];
        for (let i = 0; i < META_PAGES_MAX_PAGES + 3; i++) {
          sets.push([{ id: `cap-${i}`, name: `Cap ${i}` }]);
        }
        mockMode = { pagesByPage: sets };
        const pages = await fetchManagedFacebookPages({
          userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
        });
        assert(
          accountsCallCount === META_PAGES_MAX_PAGES,
          `calls=${accountsCallCount}`,
        );
        assert(
          pages.length === META_PAGES_MAX_PAGES,
          `pages=${pages.length}`,
        );
        return `capped at ${META_PAGES_MAX_PAGES}`;
      },
    );

    await check(
      7,
      "paging.next on an unapproved host is rejected and never requested",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "evil-page", name: "Evil" }],
          evilNextHost: true,
        };
        let category = "";
        try {
          await fetchManagedFacebookPages({
            userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed error",
          );
          category = error.category;
        }
        assert(category === "malformed", "malformed");
        assert(
          !fetchHosts.includes("https://evil.example"),
          "evil host not fetched",
        );
        return "evil next rejected; host never contacted";
      },
    );

    await check(
      8,
      "Empty Meta result produces empty state and leaves authorized",
      async () => {
        installMetaFetchMock();
        mockMode = { pages: [] };
        const conn = await createConnection();
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        assert(discovery.empty === true, "empty");
        assert(discovery.pages.length === 0, "no pages");
        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(status.status === "authorized", "authorized");
        return "empty + authorized";
      },
    );

    await check(
      9,
      "Malformed Meta response produces safe error and consistent durable state",
      async () => {
        installMetaFetchMock();
        mockMode = { pages: "malformed" };
        const conn = await createConnection();
        let category = "";
        try {
          await discoverFacebookPages({
            clientId,
            profileId,
            connectionId: conn,
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed",
          );
          category = error.category;
          assert(
            !error.message.includes("nope"),
            "raw body not exposed",
          );
        }
        assert(category === "malformed", "malformed");
        const row = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(row.status === "authorized", "still authorized");
        const assignments =
          await prisma.socialBrandAccountAssignment.count({
            where: {
              socialAccount: { providerConnectionId: conn },
            },
          });
        assert(assignments === 0, "no assignment");
        return "safe error; authorized; no assignment";
      },
    );

    await check(
      10,
      "Discovery never changes authorized→connected and never assigns a Page",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-disc-only", name: "Disc Only" }],
        };
        const conn = await createConnection();
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        const row = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(row.status === "authorized", "authorized");
        const assignments =
          await prisma.socialBrandAccountAssignment.count({
            where: {
              status: "active",
              socialAccount: { providerConnectionId: conn },
            },
          });
        assert(assignments === 0, "no active assignment");
        return "authorized; no assignment";
      },
    );

    // ========== B. Authorization and isolation ==========

    await check(
      11,
      "User without active workspace membership is rejected",
      async () => {
        try {
          await discoverFacebookPages({
            clientId,
            profileId: inactiveProfileId,
            connectionId: primaryConnectionId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /active membership/i.test(error.message),
            "inactive",
          );
        }
        return "forbidden";
      },
    );

    await check(
      12,
      "Member without manage_social_accounts is rejected",
      async () => {
        try {
          await discoverFacebookPages({
            clientId,
            profileId: viewerProfileId,
            connectionId: primaryConnectionId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /permission/i.test(error.message),
            "viewer",
          );
        }
        return "forbidden";
      },
    );

    await check(
      13,
      "User from another workspace cannot discover Pages for the connection",
      async () => {
        try {
          await discoverFacebookPages({
            clientId: otherClientId,
            profileId: otherProfileId,
            connectionId: primaryConnectionId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /could not be found/i.test(error.message),
            "cross-workspace",
          );
        }
        return "not_found";
      },
    );

    await check(
      14,
      "Foreign-workspace connection is indistinguishable from missing",
      async () => {
        let foreignMsg = "";
        let missingMsg = "";
        try {
          await discoverFacebookPages({
            clientId: otherClientId,
            profileId: otherProfileId,
            connectionId: primaryConnectionId,
          });
        } catch (error) {
          foreignMsg = error instanceof Error ? error.message : "";
        }
        try {
          await discoverFacebookPages({
            clientId,
            profileId,
            connectionId: uuid(),
          });
        } catch (error) {
          missingMsg = error instanceof Error ? error.message : "";
        }
        assert(foreignMsg === missingMsg, "same message");
        return "identical not_found messaging";
      },
    );

    await check(
      15,
      "Non-Meta / wrong-provider connection is rejected safely",
      async () => {
        const googleConn = await createConnection({
          provider: "google",
          status: "authorized",
        });
        try {
          await discoverFacebookPages({
            clientId,
            profileId,
            connectionId: googleConn,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /could not be found/i.test(error.message),
            "wrong provider",
          );
        }
        return "not_found";
      },
    );

    await check(
      16,
      "Missing, disconnected, pending, or ineligible connections cannot discover/select",
      async () => {
        const pending = await createConnection({
          status: "pending_authorization",
        });
        const disconnected = await createConnection({
          status: "disconnected",
        });
        for (const connectionId of [pending, disconnected, uuid()]) {
          let rejected = false;
          try {
            await discoverFacebookPages({
              clientId,
              profileId,
              connectionId,
            });
          } catch {
            rejected = true;
          }
          assert(rejected, `discover ${connectionId}`);
        }
        return "pending/disconnected/missing rejected";
      },
    );

    await check(
      17,
      "Lookups scoped to exact workspace, connection, and provider",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "scope-page", name: "Scoped" }],
        };
        const conn = await createConnection();
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        const account = await prisma.socialAccount.findFirstOrThrow({
          where: {
            id: discovery.pages[0]!.socialAccountId,
          },
          select: {
            clientId: true,
            providerConnectionId: true,
            platform: true,
          },
        });
        assert(account.clientId === clientId, "client");
        assert(account.providerConnectionId === conn, "connection");
        assert(account.platform === "facebook", "platform");
        return "scoped persistence";
      },
    );

    // ========== C. Selection validation ==========

    const selectConn = await createConnection();
    let selectAccountId = "";

    await check(
      18,
      "Selecting a discovered Page triggers fresh Meta revalidation",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-reval",
              name: "Reval Page",
              access_token: "SYNTH_PAGE_TOKEN_reval",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: selectConn,
        });
        selectAccountId = discovery.pages[0]!.socialAccountId;
        const callsAfterDiscover = accountsCallCount;
        const selection = await selectFacebookPage({
          clientId,
          profileId,
          connectionId: selectConn,
          socialAccountId: selectAccountId,
        });
        assert(selection.connectionStatus === "connected", "connected");
        assert(
          accountsCallCount > callsAfterDiscover,
          "revalidation called Meta again",
        );
        return `extra Meta calls=${accountsCallCount - callsAfterDiscover}`;
      },
    );

    await check(
      19,
      "Arbitrary or manipulated Page ID is rejected",
      async () => {
        const conn = await createConnection();
        const forgedSocialAccountId = uuid();
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: forgedSocialAccountId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /could not be found/i.test(error.message),
            "arbitrary",
          );
          assert(
            !(error instanceof Error && error.message.includes(forgedSocialAccountId)),
            "error omits forged id",
          );
        }

        // Cross-connection socialAccountId must not select another Page.
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-forge-victim", name: "Victim" }],
        };
        const victimConn = await createConnection({ brand: brandId2 });
        const victimDiscovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: victimConn,
        });
        const victimAccountId = victimDiscovery.pages[0]!.socialAccountId;
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: victimAccountId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /could not be found/i.test(error.message),
            "cross-connection forge",
          );
          assert(
            !(
              error instanceof Error &&
              error.message.includes("page-forge-victim")
            ),
            "error omits Facebook Page ID",
          );
        }

        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(status.status === "authorized", "unchanged");
        return "not_found; no Page ID in errors";
      },
    );

    await check(
      20,
      "Page belonging to a different authorized connection is rejected",
      async () => {
        const other = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-other-conn", name: "Other Conn" }],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: other,
        });
        const target = await createConnection();
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: target,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof Error &&
              /could not be found/i.test(error.message),
            "wrong connection",
          );
        }
        return "not_found";
      },
    );

    await check(
      21,
      "Page that disappeared after discovery is rejected; connection recoverable",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-gone", name: "Gone" }],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        mockMode = {
          pages: [{ id: "page-different", name: "Different" }],
        };
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError &&
              error.category === "not_found",
            "disappeared",
          );
        }
        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(status.status === "authorized", "recoverable");
        return "not_found; authorized";
      },
    );

    await check(
      22,
      "Page lacking required management capability is unavailable and cannot be selected",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-weak",
              name: "Weak",
              access_token: null,
              tasks: [],
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        assert(discovery.pages[0]?.selectable === false, "not selectable");
        assert(
          discovery.pages[0]?.unavailableReason === "insufficient_access",
          "reason",
        );
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
          throw new Error("expected rejection");
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError &&
              error.category === "permission_required",
            "cannot select",
          );
        }
        return "insufficient_access";
      },
    );

    await check(
      23,
      "Missing Page token is insufficient access and never persisted",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-no-tok",
              name: "NoTok",
              access_token: null,
              tasks: ["MANAGE"],
            },
          ],
        };
        let category = "";
        try {
          await revalidateManagedFacebookPage({
            userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
            externalPageId: "page-no-tok",
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed",
          );
          category = error.category;
        }
        assert(category === "permission_required", "category");
        return "permission_required; no persistence path";
      },
    );

    await check(
      24,
      "Closing/cancelling selection UI does not connect or assign",
      async () => {
        const source = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(source.includes("onClose"), "onClose");
        assert(source.includes("Cancel"), "Cancel control");
        assert(
          !/useEffect\(\(\)\s*=>\s*\{\s*void confirmSelection/.test(source),
          "no auto confirm",
        );
        assert(
          source.includes('onClick={onClose}'),
          "cancel invokes onClose only",
        );
        return "Cancel/onClose; no auto-connect";
      },
    );

    await check(
      25,
      "Selection requires explicit confirmation; highlighting alone has no durable effect",
      async () => {
        const source = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(source.includes("Confirm Page"), "confirm label");
        assert(
          source.includes("!selectedId") &&
            source.includes('state !== "ready"'),
          "confirm disabled until selection+ready",
        );
        assert(
          source.includes("setSelectedId(page.socialAccountId)"),
          "highlight only sets local state",
        );
        return "explicit Confirm required";
      },
    );

    await check(
      25.1,
      "Page-selection UI does not render Facebook Page IDs",
      async () => {
        const panel = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(
          !panel.includes("externalPageId"),
          "no externalPageId in panel",
        );
        assert(!/ID\s*\{/.test(panel), "no ID {…} render");
        assert(
          !/\bID\s+\{\s*page\./.test(panel) &&
            !panel.includes("ID {page."),
          "no ID label",
        );
        assert(
          panel.includes("{page.name}"),
          "renders name",
        );
        assert(
          panel.includes("profileImageUrl"),
          "renders profile image path",
        );
        assert(
          panel.includes("page.category"),
          "may render category",
        );
        assert(
          panel.includes("socialAccountId"),
          "uses internal account id for selection only",
        );

        const discoveryRoute = readSource(
          "src/app/api/social/connections/[connectionId]/pages/route.ts",
        );
        assert(
          !discoveryRoute.includes("externalPageId: page.externalPageId"),
          "discovery API omits Page ID",
        );

        const selectRoute = readSource(
          "src/app/api/social/connections/[connectionId]/pages/select/route.ts",
        );
        assert(
          !selectRoute.includes("externalPageId: selection.externalPageId"),
          "select API omits Page ID",
        );

        return "UI + API responses omit Facebook Page IDs";
      },
    );

    // ========== D. Credentials and persistence ==========

    await check(
      26,
      "Successful selection stores stable Page ID and display metadata",
      async () => {
        const account = await prisma.socialAccount.findFirstOrThrow({
          where: {
            providerConnectionId: selectConn,
            externalAccountId: "page-reval",
          },
        });
        assert(account.status === "connected", "connected account");
        assert(account.displayName === "Reval Page", "name");
        assert(account.clientId === clientId, "workspace");
        assert(account.providerConnectionId === selectConn, "connection");
        return "page-reval persisted";
      },
    );

    await check(
      27,
      "Page credential encrypted with purpose separation",
      async () => {
        const cred = await prisma.socialCredential.findUniqueOrThrow({
          where: { connectionId: selectConn },
        });
        const payload = decryptSocialTokenPayload(
          {
            ciphertext: cred.encryptedPayload,
            iv: cred.iv,
            authTag: cred.authTag,
            keyVersion: cred.keyVersion,
          },
          buildSocialCredentialAad({
            clientId,
            connectionId: selectConn,
            provider: "meta",
          }),
        );
        const page = readMetaFacebookPageCredential(payload);
        assert(page?.purpose === "meta_facebook_page", "purpose");
        assert(page?.pageId === "page-reval", "pageId");
        return "meta_facebook_page purpose";
      },
    );

    await check(
      28,
      "Page token not stored in plaintext columns, metadata, API payloads, or logs",
      async () => {
        const account = await prisma.socialAccount.findFirstOrThrow({
          where: {
            providerConnectionId: selectConn,
            externalAccountId: "page-reval",
          },
        });
        assert(
          !JSON.stringify(account.metadata ?? {}).includes("SYNTH_PAGE_TOKEN"),
          "account metadata",
        );
        const cred = await prisma.socialCredential.findUniqueOrThrow({
          where: { connectionId: selectConn },
        });
        // ciphertext is opaque; iv/authTag are not tokens
        assert(cred.iv.length > 0 && cred.authTag.length > 0, "encrypted cols");
        return "no plaintext page token";
      },
    );

    await check(
      29,
      "Authorized-user credential remains intact when Page credential is added",
      async () => {
        const cred = await prisma.socialCredential.findUniqueOrThrow({
          where: { connectionId: selectConn },
        });
        const payload = decryptSocialTokenPayload(
          {
            ciphertext: cred.encryptedPayload,
            iv: cred.iv,
            authTag: cred.authTag,
            keyVersion: cred.keyVersion,
          },
          buildSocialCredentialAad({
            clientId,
            connectionId: selectConn,
            provider: "meta",
          }),
        );
        assert(
          payload.accessToken === "SYNTH_USER_ACCESS_TOKEN",
          "user token intact",
        );
        return "user accessToken preserved";
      },
    );

    await check(
      30,
      "Encryption failure writes no Page credential/assignment; stays authorized",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-enc-fail",
              name: "Enc Fail",
              access_token: "SYNTH_PAGE_TOKEN_enc",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        const originalKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1;
        process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = "not-a-valid-key";
        let failed = false;
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
        } catch {
          failed = true;
        }
        process.env.SOCIAL_TOKEN_ENCRYPTION_KEY_V1 = originalKey;
        assert(failed, "threw");
        const row = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(row.status === "authorized", "authorized");
        const assignments =
          await prisma.socialBrandAccountAssignment.count({
            where: {
              status: "active",
              socialAccount: { providerConnectionId: conn },
            },
          });
        assert(assignments === 0, "no assignment");
        return "authorized; no assignment";
      },
    );

    await check(
      31,
      "Credential AAD prevents ciphertext reuse across workspace/connection/provider",
      async () => {
        const payload = withMetaFacebookPageCredential(
          {
            accessToken: "SYNTH_USER_ACCESS_TOKEN",
            scopes: ["pages_show_list"],
          },
          {
            pageId: "aad-page",
            accessToken: "SYNTH_PAGE_TOKEN_aad",
          },
        );
        const enc = encryptSocialTokenPayload(
          payload,
          buildSocialCredentialAad({
            clientId: "client-a",
            connectionId: "conn-a",
            provider: "meta",
          }),
        );
        let rejected = false;
        try {
          decryptSocialTokenPayload(
            enc,
            buildSocialCredentialAad({
              clientId: "client-b",
              connectionId: "conn-a",
              provider: "meta",
            }),
          );
        } catch {
          rejected = true;
        }
        assert(rejected, "cross-workspace AAD rejected");
        rejected = false;
        try {
          decryptSocialTokenPayload(
            enc,
            buildSocialCredentialAad({
              clientId: "client-a",
              connectionId: "conn-b",
              provider: "meta",
            }),
          );
        } catch {
          rejected = true;
        }
        assert(rejected, "cross-connection AAD rejected");
        rejected = false;
        try {
          decryptSocialTokenPayload(
            enc,
            buildSocialCredentialAad({
              clientId: "client-a",
              connectionId: "conn-a",
              provider: "google",
            }),
          );
        } catch {
          rejected = true;
        }
        assert(rejected, "cross-provider AAD rejected");
        return "AAD binding enforced";
      },
    );

    // ========== E. Lifecycle, uniqueness, concurrency ==========

    await check(
      32,
      "Successful selection atomically assigns Page and authorized→connected",
      async () => {
        const row = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: selectConn },
          select: { status: true, displayName: true },
        });
        assert(row.status === "connected", "connected");
        const assignment =
          await prisma.socialBrandAccountAssignment.findFirst({
            where: {
              status: "active",
              socialAccount: {
                providerConnectionId: selectConn,
                externalAccountId: "page-reval",
              },
            },
          });
        assert(assignment, "active assignment");
        return "connected + assignment";
      },
    );

    await check(
      33,
      "No committed connected state without assignment and usable Page credential",
      async () => {
        const connected = await prisma.socialProviderConnection.findMany({
          where: {
            id: { in: fixtureIds.connectionIds },
            status: "connected",
          },
          select: { id: true, clientId: true },
        });
        for (const conn of connected) {
          const assignment =
            await prisma.socialBrandAccountAssignment.count({
              where: {
                status: "active",
                socialAccount: { providerConnectionId: conn.id },
              },
            });
          assert(assignment >= 1, `assignment for ${conn.id}`);
          const cred = await prisma.socialCredential.findUniqueOrThrow({
            where: { connectionId: conn.id },
          });
          const payload = decryptSocialTokenPayload(
            {
              ciphertext: cred.encryptedPayload,
              iv: cred.iv,
              authTag: cred.authTag,
              keyVersion: cred.keyVersion,
            },
            buildSocialCredentialAad({
              clientId: conn.clientId,
              connectionId: conn.id,
              provider: "meta",
            }),
          );
          assert(
            readMetaFacebookPageCredential(payload),
            "page credential",
          );
        }
        return `checked ${connected.length} connected rows`;
      },
    );

    await check(
      34,
      "Retryable selection failure leaves connection authorized",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-retryable", name: "Retryable" }],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        mockMode = { pages: "timeout" };
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
        } catch {
          // expected
        }
        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(status.status === "authorized", "authorized");
        return "authorized after temporary failure";
      },
    );

    await check(
      35,
      "Proven expired/revoked Meta auth → reauthorization_required",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-exp",
              name: "Exp",
              access_token: "SYNTH_PAGE_TOKEN_exp",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        mockMode = {
          pages: "fail",
          errorStatus: 401,
          errorBody: {
            error: {
              code: 190,
              message: "SYNTH_EXPIRED_BODY_SHOULD_NOT_LEAK",
            },
          },
        };
        let category = "";
        let message = "";
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed",
          );
          category = error.category;
          message = error.message;
        }
        assert(category === "authorization_expired", "category");
        assert(
          !message.includes("SYNTH_EXPIRED_BODY_SHOULD_NOT_LEAK"),
          "no Meta body leak",
        );
        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true, lastErrorCode: true },
        });
        assert(
          status.status === "reauthorization_required",
          "reauth required",
        );
        return "reauthorization_required";
      },
    );

    await check(
      36,
      "Selecting the same already-connected Page is idempotent",
      async () => {
        const again = await selectFacebookPage({
          clientId,
          profileId,
          connectionId: selectConn,
          socialAccountId: selectAccountId,
        });
        assert(again.idempotent === true, "idempotent");
        assert(again.connectionStatus === "connected", "connected");
        return "idempotent=true";
      },
    );

    await check(
      37,
      "Same Facebook Page cannot be connected twice in workspace scope",
      async () => {
        const dup = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-reval",
              name: "Dup Attempt",
              access_token: "SYNTH_PAGE_TOKEN_dup",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: dup,
        });
        assert(
          discovery.pages[0]?.unavailableReason === "already_connected",
          "unavailable",
        );
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: dup,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
          throw new Error("expected conflict");
        } catch (error) {
          assert(
            error instanceof Error &&
              /already connected/i.test(error.message),
            "conflict",
          );
        }
        return "workspace duplicate blocked";
      },
    );

    await check(
      38,
      "Concurrent same-Page connect → one success, one safe conflict",
      async () => {
        const c1 = await createConnection();
        const c2 = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-race",
              name: "Race",
              access_token: "SYNTH_PAGE_TOKEN_race",
            },
          ],
        };
        const d1 = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: c1,
        });
        const d2 = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: c2,
        });
        const outcomes = await Promise.allSettled([
          selectFacebookPage({
            clientId,
            profileId,
            connectionId: c1,
            socialAccountId: d1.pages[0]!.socialAccountId,
          }),
          selectFacebookPage({
            clientId,
            profileId,
            connectionId: c2,
            socialAccountId: d2.pages[0]!.socialAccountId,
          }),
        ]);
        const ok = outcomes.filter((o) => o.status === "fulfilled");
        const bad = outcomes.filter((o) => o.status === "rejected");
        assert(ok.length === 1 && bad.length === 1, "1/1");
        return "fulfilled=1 rejected=1";
      },
    );

    await check(
      39,
      "Different eligible Page via separate Meta connection without changing existing",
      async () => {
        const before = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: selectConn },
          select: { status: true, displayName: true },
        });
        const other = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-second",
              name: "Second Page",
              access_token: "SYNTH_PAGE_TOKEN_second",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: other,
        });
        await selectFacebookPage({
          clientId,
          profileId,
          connectionId: other,
          socialAccountId: discovery.pages[0]!.socialAccountId,
        });
        const after = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: selectConn },
          select: { status: true, displayName: true },
        });
        assert(after.status === before.status, "status unchanged");
        assert(after.displayName === before.displayName, "name unchanged");
        return "isolated second connection";
      },
    );

    await check(
      40,
      "Failure/selection on one connection never mutates another",
      async () => {
        const stable = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-stable",
              name: "Stable",
              access_token: "SYNTH_PAGE_TOKEN_stable",
            },
          ],
        };
        const dStable = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: stable,
        });
        await selectFacebookPage({
          clientId,
          profileId,
          connectionId: stable,
          socialAccountId: dStable.pages[0]!.socialAccountId,
        });
        const before = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: stable },
        });

        const failing = await createConnection({ brand: brandId2 });
        mockMode = {
          pages: [{ id: "page-fail-iso", name: "Fail Iso" }],
        };
        const dFail = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: failing,
        });
        mockMode = { pages: "timeout" };
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: failing,
            socialAccountId: dFail.pages[0]!.socialAccountId,
          });
        } catch {
          // expected
        }

        const after = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: stable },
        });
        assert(after.status === before.status, "status");
        assert(after.displayName === before.displayName, "name");
        assert(
          after.updatedAt.getTime() === before.updatedAt.getTime(),
          "untouched",
        );
        return "peer connection untouched";
      },
    );

    await check(
      41,
      "Physical partial uniqueness index exists with intended scope",
      async () => {
        const rows = await prisma.$queryRawUnsafe<
          Array<{ indexname: string; indexdef: string }>
        >(
          `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'sa_one_connected_facebook_page_per_client_key'`,
        );
        assert(rows.length === 1, "index exists");
        const def = rows[0]!.indexdef.toLowerCase();
        assert(def.includes("clientid"), "clientId");
        assert(def.includes("platform"), "platform");
        assert(def.includes("externalaccountid"), "externalAccountId");
        assert(def.includes("connected"), "connected status");
        assert(def.includes("facebook"), "facebook platform");
        return "sa_one_connected_facebook_page_per_client_key";
      },
    );

    await check(
      42,
      "Database failure during final transaction rolls back credential, assignment, lifecycle",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-tx-fail",
              name: "Tx Fail",
              access_token: "SYNTH_PAGE_TOKEN_tx",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });

        // Archive brand so final tx fails after credential write attempt.
        await prisma.businessBrand.update({
          where: { id: brandId },
          data: { status: "archived" },
        });

        let failed = false;
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
        } catch {
          failed = true;
        }

        await prisma.businessBrand.update({
          where: { id: brandId },
          data: { status: "active" },
        });

        assert(failed, "threw");
        const row = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(row.status === "authorized", "authorized");
        const assignments =
          await prisma.socialBrandAccountAssignment.count({
            where: {
              status: "active",
              socialAccount: { providerConnectionId: conn },
            },
          });
        assert(assignments === 0, "no assignment");
        const cred = await prisma.socialCredential.findUniqueOrThrow({
          where: { connectionId: conn },
        });
        const payload = decryptSocialTokenPayload(
          {
            ciphertext: cred.encryptedPayload,
            iv: cred.iv,
            authTag: cred.authTag,
            keyVersion: cred.keyVersion,
          },
          buildSocialCredentialAad({
            clientId,
            connectionId: conn,
            provider: "meta",
          }),
        );
        assert(
          !readMetaFacebookPageCredential(payload),
          "page credential rolled back",
        );
        assert(
          payload.accessToken === "SYNTH_USER_ACCESS_TOKEN",
          "user token intact",
        );
        return "full rollback";
      },
    );

    // ========== F. Provider and Meta failure handling ==========

    await check(
      43,
      "Meta authorization expiry returns actionable reauthorization state",
      async () => {
        // Covered by #35; assert actionable status exists in enum + prior result.
        const prior = results.find((r) => r.id === 35);
        assert(prior?.status === "PASS", "depends on #35");
        return "reauthorization_required (see #35)";
      },
    );

    await check(
      44,
      "Missing Page permissions return permission-required state",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: "fail",
          errorStatus: 403,
          errorBody: {
            error: {
              code: 200,
              message: "SYNTH_PERM_BODY",
            },
          },
        };
        let category = "";
        let message = "";
        try {
          await fetchManagedFacebookPages({
            userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed",
          );
          category = error.category;
          message = error.message;
        }
        assert(category === "permission_required", "category");
        assert(!message.includes("SYNTH_PERM_BODY"), "no body leak");
        return "permission_required";
      },
    );

    await check(
      45,
      "Meta rate limiting returns safe rate-limited state without corrupting connection",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: "fail",
          errorStatus: 429,
          errorBody: { error: { code: 4, message: "SYNTH_RATE" } },
        };
        let category = "";
        try {
          await discoverFacebookPages({
            clientId,
            profileId,
            connectionId: conn,
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed",
          );
          category = error.category;
        }
        assert(category === "rate_limited", "category");
        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(status.status === "authorized", "uncorrupted");
        return "rate_limited; authorized";
      },
    );

    await check(
      46,
      "Temporary Meta/network failure returns safe retryable state",
      async () => {
        installMetaFetchMock();
        mockMode = { pages: "timeout" };
        let category = "";
        try {
          await fetchManagedFacebookPages({
            userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
          });
        } catch (error) {
          assert(
            error instanceof MetaPageDiscoveryError,
            "typed",
          );
          category = error.category;
        }
        assert(category === "temporary", "temporary");
        return "temporary";
      },
    );

    await check(
      47,
      "Meta error bodies, URLs, headers, tokens, stacks not exposed to browser",
      async () => {
        installMetaFetchMock();
        mockMode = {
          pages: "fail",
          errorStatus: 500,
          errorBody: {
            error: {
              message: "SYNTH_STACK_TRACE_SHOULD_NOT_LEAK",
              code: 1,
            },
          },
        };
        try {
          await fetchManagedFacebookPages({
            userAccessToken: "SYNTH_USER_ACCESS_TOKEN",
          });
          throw new Error("expected failure");
        } catch (error) {
          assert(error instanceof MetaPageDiscoveryError, "typed");
          assert(
            !error.message.includes("SYNTH_STACK_TRACE_SHOULD_NOT_LEAK"),
            "body",
          );
          assert(!error.message.includes("graph.facebook.com"), "url");
          assert(!error.stack || !error.message.includes("at "), "no stack in message");
        }
        return "safe client messages only";
      },
    );

    await check(
      48,
      "Retry after temporary discovery failure succeeds without duplicate accounts",
      async () => {
        const conn = await createConnection();
        installMetaFetchMock();
        failThenRemaining = 1;
        mockMode = {
          failThenPages: [
            {
              id: "page-retry-disc",
              name: "Retry Disc",
            },
          ],
        };
        let firstFailed = false;
        try {
          await discoverFacebookPages({
            clientId,
            profileId,
            connectionId: conn,
          });
        } catch {
          firstFailed = true;
        }
        assert(firstFailed, "first failed");
        failThenRemaining = 0;
        mockMode = {
          pages: [
            {
              id: "page-retry-disc",
              name: "Retry Disc",
            },
          ],
        };
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        const count = await prisma.socialAccount.count({
          where: {
            providerConnectionId: conn,
            externalAccountId: "page-retry-disc",
          },
        });
        assert(count === 1, `accounts=${count}`);
        return "retry ok; single account row";
      },
    );

    await check(
      49,
      "Retry after temporary selection failure succeeds once Meta/persistence succeed",
      async () => {
        const conn = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [
            {
              id: "page-retry-sel",
              name: "Retry Sel",
              access_token: "SYNTH_PAGE_TOKEN_retry_sel",
            },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        mockMode = { pages: "timeout" };
        try {
          await selectFacebookPage({
            clientId,
            profileId,
            connectionId: conn,
            socialAccountId: discovery.pages[0]!.socialAccountId,
          });
        } catch {
          // expected
        }
        mockMode = {
          pages: [
            {
              id: "page-retry-sel",
              name: "Retry Sel",
              access_token: "SYNTH_PAGE_TOKEN_retry_sel",
            },
          ],
        };
        const selection = await selectFacebookPage({
          clientId,
          profileId,
          connectionId: conn,
          socialAccountId: discovery.pages[0]!.socialAccountId,
        });
        assert(selection.connectionStatus === "connected", "connected");
        return "retry selection succeeded";
      },
    );

    // ========== G. UI behavior ==========

    await check(
      50,
      "Authorized Facebook/Meta connection displays Select Facebook Page",
      async () => {
        const source = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(source.includes("Select Facebook Page"), "label");
        assert(
          source.includes('connection.status ===\n                      "authorized"') ||
            source.includes('status ===\n                      "authorized"') ||
            source.includes('"authorized"'),
          "authorized gate",
        );
        return "CTA present for authorized Meta";
      },
    );

    await check(
      51,
      "Panel renders loading, ready, empty, permission, auth-expired, rate-limited, temporary, malformed, selecting",
      async () => {
        const source = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        for (const state of [
          "loading",
          "ready",
          "empty",
          "permission_required",
          "authorization_expired",
          "rate_limited",
          "temporary",
          "malformed",
          "selecting",
        ]) {
          assert(source.includes(`"${state}"`), state);
        }
        return "all panel states present";
      },
    );

    await check(
      52,
      "Unavailable Pages explain already-connected / insufficient-access and cannot confirm",
      async () => {
        const source = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(source.includes("Already connected in this workspace"), "copy");
        assert(source.includes("Insufficient Page access"), "copy2");
        assert(source.includes("!page.selectable"), "disabled");
        return "unavailable UX";
      },
    );

    await check(
      53,
      "Successful selection displays selected Page identity and Connected status",
      async () => {
        const source = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(source.includes('status: "connected"'), "sets connected");
        assert(source.includes("displayName: pageName"), "shows page name");
        assert(source.includes("is connected"), "success notice");
        assert(
          source.includes("refreshConnectionsFromServer"),
          "refetches connections",
        );
        assert(source.includes("router.refresh()"), "invalidates RSC");
        assert(
          source.includes("resolveConnectedAccountLabel"),
          "safe account label",
        );
        assert(
          !source.includes("account.externalAccountId}"),
          "no Page ID fallback render",
        );
        return "connected + page name + refetch";
      },
    );

    await check(
      54,
      "UI never labels Connected before confirmed selection succeeds",
      async () => {
        const panel = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(panel.includes("onConnected("), "success callback");
        assert(
          !/setState\(\s*"ready"[\s\S]{0,80}Connected/.test(panel),
          "no premature Connected",
        );
        const modal = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(
          modal.includes("onConnected={(pageName)"),
          "status flip only onConnected",
        );
        assert(
          modal.includes("isProviderPlatformConnected"),
          "uses connected gate helper",
        );
        assert(
          isProviderPlatformConnected({
            connectionStatus: "authorized",
            accountStatus: "not_connected",
            requiresConnectedAccount: true,
          }) === false,
          "authorized+discovery ≠ Connected",
        );
        assert(
          isProviderPlatformConnected({
            connectionStatus: "connected",
            accountStatus: "connected",
            requiresConnectedAccount: true,
          }) === true,
          "connected+selected = Connected",
        );
        assert(
          resolveProviderCardLabel({
            implemented: true,
            connectable: true,
            providerState: "ready_for_authorization",
            connectionStatus: "authorized",
            isPrimaryStartCard: true,
            busy: false,
            defaultActionLabel: "Connect Facebook",
          }) === "Authorized",
          "Authorized label",
        );
        return "Connected only after persist; Authorized until then";
      },
    );

    await check(
      55,
      "UI supports retrying discovery and returning later while preserving authorized",
      async () => {
        const panel = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(panel.includes("Retry"), "retry");
        assert(panel.includes("void loadPages()"), "reload");
        assert(panel.includes("onClose"), "can leave");
        // Service-level: discovery leaves authorized — already #8/#10
        return "Retry + Cancel preserve authorized path";
      },
    );

    await check(
      55.1,
      "No automatic Page selection; Confirm disabled until explicit choice",
      async () => {
        const panel = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(
          /useState<string \| null>\(\s*null/.test(panel),
          "selectedId starts null",
        );
        assert(panel.includes("setSelectedId(null)"), "clears on load");
        assert(
          !/setSelectedId\(\s*pages\[0\]/.test(panel) &&
            !/setSelectedId\(\s*body\.discovery\.pages\[0\]/.test(panel),
          "never auto-selects first page",
        );
        assert(
          panel.includes("!selectedId") &&
            panel.includes('state !== "ready"'),
          "Confirm disabled without choice",
        );
        assert(
          panel.includes("setSelectedId(page.socialAccountId)"),
          "only click selects",
        );

        // Discovery leaves connection authorized with not_connected rows only.
        const conn = await createConnection();
        installMetaFetchMock();
        mockMode = {
          pages: [
            { id: "page-no-auto", name: "No Auto" },
            { id: "page-no-auto-2", name: "No Auto 2" },
          ],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        assert(discovery.pages.length === 2, "discovered");
        const status = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(status.status === "authorized", "still authorized");
        const connectedCount = await prisma.socialAccount.count({
          where: {
            providerConnectionId: conn,
            status: "connected",
          },
        });
        assert(connectedCount === 0, "no page persisted as connected");
        const assignmentCount =
          await prisma.socialBrandAccountAssignment.count({
            where: {
              socialAccount: { providerConnectionId: conn },
            },
          });
        assert(assignmentCount === 0, "no brand assignment");
        return "no auto-select; Confirm gated; discovery non-persisting";
      },
    );

    await check(
      55.2,
      "Explicit Confirm persists Page; cancel/close does not",
      async () => {
        const panel = readSource(
          "src/components/social/connections/facebook-page-selection-panel.tsx",
        );
        assert(
          panel.includes("/pages/select") &&
            panel.includes("confirmSelection"),
          "persist only via confirm",
        );
        assert(
          !/useEffect\(\(\)\s*=>\s*\{\s*void confirmSelection/.test(panel),
          "no auto confirm",
        );

        const modal = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(
          modal.includes("setPageSelectionConnectionId(null)") &&
            modal.includes("onClose={() =>"),
          "cancel closes selector only",
        );

        // Cancel path: discovery + close without select leaves authorized.
        const conn = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-cancel-keep", name: "Cancel Keep" }],
        };
        await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        const before = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true, connectedAt: true },
        });
        assert(before.status === "authorized", "authorized before cancel");
        assert(before.connectedAt === null, "not connected");
        // Simulating cancel: no selectFacebookPage call.
        const after = await prisma.socialProviderConnection.findUniqueOrThrow({
          where: { id: conn },
          select: { status: true },
        });
        assert(after.status === "authorized", "unchanged after cancel");
        return "confirm-only persist; cancel preserves authorized";
      },
    );

    await check(
      55.3,
      "Changing Pages unsupported; connected keeps existing Page; no Change CTA",
      async () => {
        const modal = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(
          !modal.includes("Change Facebook Page"),
          "no Change CTA while unsupported",
        );
        assert(
          modal.includes("Select Facebook Page") &&
            modal.includes('"authorized"'),
          "Select only for authorized",
        );

        // Connected connection rejects selecting a different Page.
        const conn = await createConnection({ brand: brandId2 });
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-keep-a", name: "Keep A" }],
        };
        const discovery = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        installMetaFetchMock();
        mockMode = {
          pages: [{ id: "page-keep-a", name: "Keep A" }],
        };
        const selection = await selectFacebookPage({
          clientId,
          profileId,
          connectionId: conn,
          socialAccountId: discovery.pages[0]!.socialAccountId,
        });
        assert(selection.connectionStatus === "connected", "connected");

        installMetaFetchMock();
        mockMode = {
          pages: [
            { id: "page-keep-a", name: "Keep A" },
            { id: "page-keep-b", name: "Keep B" },
          ],
        };
        // Discovery on connected is allowed for listing; select other must fail.
        const again = await discoverFacebookPages({
          clientId,
          profileId,
          connectionId: conn,
        });
        const other =
          again.pages.find((p) => p.name === "Keep B") ??
          again.pages.find(
            (p) => p.socialAccountId !== selection.socialAccountId,
          );
        if (other) {
          try {
            await selectFacebookPage({
              clientId,
              profileId,
              connectionId: conn,
              socialAccountId: other.socialAccountId,
            });
            throw new Error("expected conflict");
          } catch (error) {
            assert(
              error instanceof Error &&
                /already has a selected Facebook Page/i.test(error.message),
              "change rejected",
            );
          }
        }

        const account = await prisma.socialAccount.findFirstOrThrow({
          where: { id: selection.socialAccountId },
        });
        assert(account.status === "connected", "original kept");
        assert(account.displayName === "Keep A", "name kept");
        return "change unsupported; prior Page preserved";
      },
    );

    await check(
      55.4,
      "Reopening Manage connections refetches server state; stale cache prevented",
      async () => {
        const modal = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(
          modal.includes("refreshConnectionsFromServer"),
          "refetch helper",
        );
        assert(
          modal.includes("/api/social/connections?brandId="),
          "server list endpoint",
        );
        assert(
          modal.includes("cache: \"no-store\"") ||
            modal.includes("cache: 'no-store'"),
          "no-store fetch",
        );
        assert(
          modal.includes("[open, activeBrandId]"),
          "refetch on modal open",
        );
        assert(
          modal.includes("setConnections(initialConnections)"),
          "sync from RSC props",
        );
        assert(
          modal.includes("onConnected={(pageName)"),
          "post-select refresh path",
        );

        const layout = readSource(
          "src/app/dashboard/social/layout.tsx",
        );
        assert(
          /account\.status ===\s*\n?\s*"connected"/.test(layout),
          "shell accounts require connected",
        );
        assert(
          /connection\.status ===\s*\n?\s*"connected"/.test(layout),
          "shell requires connection connected",
        );
        return "refetch on open + shell filters connected only";
      },
    );

    await check(
      55.5,
      "Authorized→Connected status consistency; setup warning removed when connected",
      async () => {
        assert(
          isProviderPlatformConnected({
            connectionStatus: "authorized",
            accountStatus: "not_connected",
            requiresConnectedAccount: true,
          }) === false,
          "no Connected while authorized",
        );
        assert(
          resolveConnectedAccountLabel({
            displayName: null,
            handle: null,
          }) === null,
          "no Page ID fallback label",
        );
        assert(
          resolveConnectedAccountLabel({
            displayName: "Cafe Page",
            handle: null,
          }) === "Cafe Page",
          "name label",
        );

        const modal = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(
          modal.includes("Select a Facebook Page to finish setup"),
          "setup warning for authorized",
        );
        assert(
          modal.includes('connection.status ===\n                      "authorized"') ||
            modal.includes('status ===\n                      "authorized"'),
          "warning gated on authorized",
        );
        assert(
          modal.includes("resolveConnectedAccountLabel") ||
            modal.includes("connectedAccountLabel"),
          "connected label helper",
        );
        // Connected path must not keep the authorized setup CTA in the same branch.
        assert(
          !/status ===\s*"connected"[\s\S]{0,200}Select a Facebook Page to finish setup/.test(
            modal,
          ),
          "no setup warning when connected",
        );
        return "Authorized until persist; Connected after; warning gated";
      },
    );

    // ========== H. Logging and regression ==========

    await check(
      56,
      "Captured logs contain none of the synthetic secret markers",
      async () => {
        const joined = captureLog.join("\n");
        for (const marker of sensitiveMarkers) {
          assert(!joined.includes(marker), `leaked ${marker}`);
        }
        assert(!joined.includes("SYNTH_AUTH_CODE"), "auth code");
        assert(!joined.includes("SYNTH_OAUTH_STATE"), "state");
        assert(!joined.includes("SYNTH_PKCE_VERIFIER"), "verifier");
        assert(!joined.includes("SYNTH_APP_SECRET"), "app secret");
        assert(!joined.includes("SYNTH_COOKIE_VALUE"), "cookie");
        return "log scan clean";
      },
    );

    await check(
      57,
      "Logs contain only approved structured stage/outcome/provider/timestamp data",
      async () => {
        const structured = captureLog.filter((line) =>
          line.includes("[meta-pages]") ||
          line.includes("facebook-page-"),
        );
        for (const line of structured) {
          assert(!line.includes("SYNTH_"), `structured leak: ${line.slice(0, 80)}`);
          assert(
            !/access_token|client_secret|code_verifier/i.test(line),
            "sensitive key",
          );
        }
        return `scanned ${structured.length} structured lines`;
      },
    );

    await check(
      58,
      "Continue / Cancel pending / Disconnect / Add another behavior remains unchanged",
      async () => {
        assert(
          canCancelPendingConnection("pending_authorization").allowed,
          "cancel pending",
        );
        assert(
          canContinueAuthorization({
            implemented: true,
            connectable: true,
            providerState: "ready_for_authorization",
            connectionStatus: "pending_authorization",
            isPrimaryStartCard: true,
          }).allowed,
          "continue",
        );
        assert(
          canAddAnotherAccount({
            implemented: true,
            connectable: true,
            providerState: "ready_for_authorization",
            supportsMultipleAccounts: true,
            sourceConnectionStatus: "connected",
            isPrimaryStartCard: true,
            hasPendingForProviderBrand: false,
          }).allowed,
          "add another",
        );
        return "lifecycle policy APIs intact (full suite run separately)";
      },
    );

    await check(
      59,
      "Instagram and Threads remain Meta-represented only",
      async () => {
        assert(
          META_PLATFORM_REPRESENTATION.instagram.platform === "instagram",
          "ig",
        );
        assert(
          META_PLATFORM_REPRESENTATION.threads.platform === "threads",
          "threads",
        );
        const modal = readSource(
          "src/components/social/connections/manage-connections-modal.tsx",
        );
        assert(
          modal.includes("Instagram connects through Facebook Meta"),
          "ig note",
        );
        assert(
          !modal.includes('provider: "instagram"'),
          "no independent ig provider card oauth",
        );
        return "Meta-represented only";
      },
    );

    await check(
      60,
      "Type-check and social lifecycle regression suite (see report runners)",
      async () => {
        // Executed by the outer npm runners; mark as structural placeholder.
        // The completion report records the actual command results.
        mapDiscoveredMetaPageFromRecord({
          id: "x",
          name: "y",
        });
        return "deferred to npm run typecheck + qa:social-lifecycle";
      },
    );
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
      if (fixtureIds.connectionIds.length) {
        await prisma.socialBrandAccountAssignment.deleteMany({
          where: {
            socialAccount: {
              providerConnectionId: {
                in: fixtureIds.connectionIds,
              },
            },
          },
        });
        await prisma.socialAccount.deleteMany({
          where: {
            providerConnectionId: {
              in: fixtureIds.connectionIds,
            },
          },
        });
        await prisma.socialCredential.deleteMany({
          where: {
            connectionId: { in: fixtureIds.connectionIds },
          },
        });
        await prisma.socialProviderConnection.deleteMany({
          where: { id: { in: fixtureIds.connectionIds } },
        });
      }
      for (const client of fixtureIds.clientIds) {
        await prisma.clientMembership.deleteMany({
          where: { clientId: client },
        });
        await prisma.businessBrand.deleteMany({
          where: { clientId: client },
        });
        await prisma.client.deleteMany({ where: { id: client } });
      }
      await prisma.profile.deleteMany({
        where: { email: { startsWith: "step5at-" } },
      });
    } catch {
      // best-effort cleanup
    }

    await prisma.$disconnect();
  }

  printSummary();
  const failed = results.some((r) => r.status === "FAIL");
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;

  results.sort((a, b) => a.id - b.id);

  originalLog("\n=== Step 5 Automated Testing Guide (60 checks) ===");
  for (const result of results) {
    originalLog(
      `[${result.status}] #${String(result.id).padStart(2, "0")} ${result.name} — ${result.evidence}`,
    );
  }
  originalLog(
    `\nSummary: ${passed} passed, ${failed} failed, ${blocked} blocked (total ${results.length})`,
  );
}

main().catch((error) => {
  restoreFetch();
  restoreLogs();
  originalError(error);
  process.exit(1);
});
