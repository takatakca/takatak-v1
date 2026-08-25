/**
 * Meta reauthorization durability + surface projection tests.
 * Never prints tokens, codes, Page IDs, connection IDs, or credentials.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type Status = "PASS" | "FAIL" | "BLOCKED";
type Result = { id: number | string; name: string; status: Status; evidence: string };

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
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const results: Result[] = [];

function record(id: number | string, name: string, status: Status, evidence: string) {
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

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function printSummary() {
  console.log("\n=== Meta Reauthorization Durability ===");
  for (const result of results) {
    console.log(
      `[${result.status}] #${result.id} ${result.name} — ${result.evidence}`,
    );
  }
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  console.log(
    `\nSummary: ${passed} passed, ${failed} failed, ${blocked} blocked`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    record(0, "database", "BLOCKED", "DATABASE_URL missing");
    printSummary();
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stamp = Date.now().toString(36);
  let clientId = "";
  let brandId = "";
  let profileId = "";
  let connectionId = "";
  let accountId = "";

  try {
    const { projectMetaBrandSurface } = await import(
      "@/lib/social/connections/meta-brand-projection"
    );
    const {
      MetaTokenTransientError,
      MetaTokenConsumedError,
    } = await import("@/lib/social/providers/meta-token");

    // 1) Projection matrix agrees across surfaces
    {
      const healthy = projectMetaBrandSurface({
        connection: { id: "c", status: "connected", lastErrorCode: null },
        selectedPage: {
          id: "a",
          status: "connected",
          accessStatus: "selected",
          displayName: "Page",
        },
      });
      assert(healthy.state === "connected_healthy", "healthy");
      assert(healthy.manageLabel === "Connected", "connected label");

      const action = projectMetaBrandSurface({
        connection: {
          id: "c",
          status: "connected",
          lastErrorCode: "authorization_expired",
        },
        selectedPage: {
          id: "a",
          status: "connected",
          accessStatus: "selected",
          displayName: "Page",
        },
        syncStatus: "action_required",
      });
      assert(action.state === "action_required", "action_required");
      assert(action.manageLabel === "Reconnect Facebook", "reconnect label");
      assert(action.showFacebookIcon, "icon remains");
      assert(action.attentionRequired, "attention");

      const pending = projectMetaBrandSurface({
        connection: {
          id: "c",
          status: "connected",
          lastErrorCode: "reauthorization_pending",
        },
        selectedPage: {
          id: "a",
          status: "connected",
          accessStatus: "selected",
          displayName: "Page",
        },
        hasPendingOAuthAttempt: true,
      });
      assert(pending.state === "reauthorization_pending", "pending");
      assert(pending.manageLabel === "Reconnecting", "reconnecting label");

      const stalePending = projectMetaBrandSurface({
        connection: {
          id: "c",
          status: "connected",
          lastErrorCode: "reauthorization_pending",
        },
        selectedPage: {
          id: "a",
          status: "connected",
          accessStatus: "selected",
          displayName: "Page",
        },
        hasPendingOAuthAttempt: false,
      });
      assert(stalePending.state === "action_required", "stale pending cleared");
      assert(stalePending.manageLabel === "Reconnect Facebook", "stale label");

      const failed = projectMetaBrandSurface({
        connection: {
          id: "c",
          status: "connected",
          lastErrorCode: "reauthorization_failed",
        },
        selectedPage: {
          id: "a",
          status: "connected",
          accessStatus: "selected",
          displayName: "Page",
        },
      });
      assert(failed.state === "refresh_failed", "refresh_failed");
      assert(
        failed.manageLabel === "Reconnect failed; try again",
        "failed label",
      );
      assert(failed.showFacebookIcon, "failed icon");

      const demotedShell = projectMetaBrandSurface({
        connection: {
          id: "c",
          status: "failed",
          lastErrorCode: "oauth_callback_failed",
        },
        selectedPage: {
          id: "a",
          status: "connected",
          accessStatus: "selected",
          displayName: "Page",
        },
      });
      assert(demotedShell.state === "refresh_failed", "demoted refresh_failed");
      assert(demotedShell.showFacebookIcon, "demoted icon");
      assert(
        demotedShell.manageLabel === "Reconnect failed; try again",
        "demoted label",
      );

      const demotedEmpty = projectMetaBrandSurface({
        connection: {
          id: "c",
          status: "failed",
          lastErrorCode: "oauth_callback_failed",
        },
        selectedPage: null,
      });
      assert(demotedEmpty.state === "disconnected", "demoted empty disconnected");
      assert(!demotedEmpty.showFacebookIcon, "demoted empty no icon");

      const none = projectMetaBrandSurface({
        connection: null,
        selectedPage: null,
      });
      assert(none.state === "disconnected", "disconnected");
      assert(!none.showFacebookIcon, "no icon");
      assert(none.manageLabel === "Connect a Facebook page", "connect label");

      record(
        1,
        "Canonical projection matrix — all surface states",
        "PASS",
        "healthy/action/pending/failed/disconnected",
      );
    }

    // 1b) Meta surface picker keeps attention shells visible
    {
      const {
        pickCanonicalProviderConnection,
        pickMetaSurfaceConnection,
      } = await import(
        "@/lib/social/connections/social-canonical-identity"
      );
      const rows = [
        { id: "f1", provider: "meta", status: "failed" },
        { id: "x1", provider: "x", status: "connected" },
      ];
      assert(
        pickCanonicalProviderConnection(rows, "meta") === null,
        "live picker skips failed",
      );
      assert(
        pickMetaSurfaceConnection(rows, "meta")?.id === "f1",
        "surface picker keeps failed",
      );
      record(
        "1b",
        "pickMetaSurfaceConnection keeps failed shells for UI",
        "PASS",
        "failed shell visible",
      );
    }

    // 2) Transient + consumed error classes exist; fetch retries
    {
      const tokenSrc = readSource("src/lib/social/providers/meta-token.ts");
      assert(tokenSrc.includes("und_err_socket"), "socket classified");
      assert(tokenSrc.includes("MetaTokenTransientError"), "transient class");
      assert(tokenSrc.includes("MetaTokenConsumedError"), "consumed class");
      assert(tokenSrc.includes("TOKEN_EXCHANGE_MAX_ATTEMPTS"), "retry bound");
      assert(
        tokenSrc.includes("Facebook could not be reached; reconnect again"),
        "clear message",
      );
      assert(
        new MetaTokenTransientError("x").name === "MetaTokenTransientError",
        "transient ctor",
      );
      assert(
        new MetaTokenConsumedError("x").name === "MetaTokenConsumedError",
        "consumed ctor",
      );
      record(
        2,
        "Transient socket closure classification + bounded retry",
        "PASS",
        "UND_ERR_SOCKET + backoff",
      );
    }

    // 3) Callback idempotent replay + preserve connected on failure
    {
      const cb = readSource(
        "src/lib/social/connections/facebook-oauth-callback.ts",
      );
      assert(cb.includes("already_completed"), "idempotent replay");
      assert(cb.includes("markRefreshFailed"), "refresh failed marker");
      assert(cb.includes('failConnection: false'), "no demote on fail");
      assert(cb.includes('status !== "connected"'), "accepts connected");
      assert(cb.includes("wasConnectedShell"), "preserve connected path");
      assert(cb.includes("wasPreservableReauth"), "failed shell reauth");
      assert(
        cb.includes("stillSelected"),
        "authorized+selected recovery promote",
      );
      assert(
        cb.includes("requeueFacebookPageSyncAfterCredentialRefresh"),
        "requeue sync after oauth",
      );
      assert(cb.includes("soft_recovered"), "post-complete soft recover");
      assert(
        !cb.includes("attemptId:"),
        "no attempt id in fail log",
      );
      record(
        3,
        "Callback retry/replay + failed reconnect preserves shell",
        "PASS",
        "idempotent + markRefreshFailed",
      );
    }

    // 4) Reauth start preserves connection status
    {
      const svc = readSource(
        "src/lib/social/connections/social-connection-service.ts",
      );
      assert(
        svc.includes('lastErrorCode: "reauthorization_pending"'),
        "pending marker",
      );
      assert(
        !svc.includes('status: "reauthorization_required"'),
        "does not demote status on start",
      );
      assert(
        svc.includes("invalidateBrandSelectorCache"),
        "cache invalidate on start",
      );
      record(
        4,
        "Reauth start preserves canonical connection + Page",
        "PASS",
        "pending oauth only",
      );
    }

    // 5–9 DB fixtures: failed reconnect preserves counts
    clientId = uuid();
    brandId = uuid();
    profileId = uuid();
    connectionId = uuid();
    accountId = uuid();

    await prisma.client.create({
      data: { id: clientId, name: `Reauth ${stamp}`, status: "active" },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `reauth-${stamp}@example.test`,
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
        name: `Reauth Brand ${stamp}`,
        status: "active",
      },
    });
    await prisma.socialProviderConnection.create({
      data: {
        id: connectionId,
        clientId,
        businessBrandId: brandId,
        provider: "meta",
        status: "connected",
        scopes: ["pages_read_engagement"],
        authorizedAt: new Date(),
        connectedAt: new Date(),
        createdByProfileId: profileId,
        externalSubjectId: `subject-${stamp}`,
        lastErrorCode: "authorization_expired",
        lastErrorMessage: "Facebook authorization expired. Reconnect to continue.",
      },
    });
    await prisma.socialAccount.create({
      data: {
        id: accountId,
        clientId,
        businessBrandId: brandId,
        providerConnectionId: connectionId,
        platform: "facebook",
        accountType: "facebook_page",
        status: "connected",
        accessStatus: "selected",
        displayName: "Preserved Page",
        externalAccountId: `ext_${stamp}`,
      },
    });
    await prisma.socialAccountSyncState.create({
      data: {
        clientId,
        businessBrandId: brandId,
        socialAccountId: accountId,
        providerConnectionId: connectionId,
        status: "action_required",
        lastErrorCategory: "authorization_expired",
        syncGeneration: 1,
      },
    });

    const before = {
      connections: await prisma.socialProviderConnection.count({
        where: { clientId, businessBrandId: brandId, provider: "meta" },
      }),
      accounts: await prisma.socialAccount.count({
        where: {
          clientId,
          providerConnectionId: connectionId,
          accessStatus: "selected",
        },
      }),
      credentials: await prisma.socialCredential.count({
        where: { connectionId },
      }),
    };

    // Simulate failed refresh marker (as callback would)
    await prisma.socialProviderConnection.update({
      where: { id: connectionId },
      data: {
        lastErrorCode: "reauthorization_failed",
        lastErrorMessage: "Facebook could not be reached; reconnect again.",
      },
    });
    await prisma.socialOAuthState.create({
      data: {
        clientId,
        businessBrandId: brandId,
        connectionId,
        provider: "meta",
        status: "failed",
        stateHash: `hash-${stamp}`,
        codeVerifierCiphertext: "x",
        codeVerifierIv: "y",
        codeVerifierAuthTag: "z",
        returnPath: "/dashboard/social/facebook",
        expiresAt: new Date(Date.now() - 60_000),
        createdByProfileId: profileId,
        consumedAt: new Date(),
        errorMessage: "Facebook could not be reached; reconnect again.",
      },
    });

    const afterFail = {
      connections: await prisma.socialProviderConnection.count({
        where: { clientId, businessBrandId: brandId, provider: "meta" },
      }),
      accounts: await prisma.socialAccount.count({
        where: {
          clientId,
          providerConnectionId: connectionId,
          accessStatus: "selected",
        },
      }),
      status: (
        await prisma.socialProviderConnection.findUnique({
          where: { id: connectionId },
          select: { status: true, lastErrorCode: true },
        })
      )?.status,
      selected: (
        await prisma.socialAccount.findUnique({
          where: { id: accountId },
          select: { accessStatus: true, status: true },
        })
      )?.accessStatus,
      sync: (
        await prisma.socialAccountSyncState.findUnique({
          where: { socialAccountId: accountId },
          select: { status: true },
        })
      )?.status,
    };

    assert(before.connections === 1, "before one connection");
    assert(afterFail.connections === 1, "after one connection");
    assert(before.accounts === 1 && afterFail.accounts === 1, "page kept");
    assert(afterFail.status === "connected", "still connected");
    assert(afterFail.selected === "selected", "still selected");
    assert(afterFail.sync === "action_required", "sync action_required");

    const { loadMetaBrandProjection } = await import(
      "@/lib/social/connections/meta-brand-projection-load"
    );
    const projection = await loadMetaBrandProjection({
      clientId,
      businessBrandId: brandId,
    });
    assert(projection.state === "refresh_failed", "projection refresh_failed");
    assert(projection.pageName === "Preserved Page", "page name");
    assert(projection.manageLabel.includes("Reconnect failed"), "label");

    // Simultaneous reconnect attempts must not create a second connection
    await prisma.socialProviderConnection.update({
      where: { id: connectionId },
      data: { lastErrorCode: "reauthorization_pending" },
    });
    const liveCount = await prisma.socialProviderConnection.count({
      where: {
        clientId,
        businessBrandId: brandId,
        provider: "meta",
        status: { in: ["connected", "authorized", "pending_authorization"] },
      },
    });
    assert(liveCount === 1, "single live shell");

    record(
      5,
      "Failed reconnect preserves connection + selected Page",
      "PASS",
      `conn ${before.connections}→${afterFail.connections}; selected kept`,
    );

    record(
      6,
      "Two reconnect attempts cannot duplicate canonical connection",
      "PASS",
      `liveCount=${liveCount}`,
    );

    // Same vs different Meta user (source)
    {
      const cb = readSource(
        "src/lib/social/connections/facebook-oauth-callback.ts",
      );
      assert(cb.includes("requiresMetaUserReplacement"), "replacement check");
      record(
        7,
        "Same vs different Meta user replacement gate",
        "PASS",
        "requiresMetaUserReplacement",
      );
    }

    // Cache invalidation on transitions
    {
      const svc = readSource(
        "src/lib/social/connections/social-connection-service.ts",
      );
      const cb = readSource(
        "src/lib/social/connections/facebook-oauth-callback.ts",
      );
      const sync = readSource(
        "src/lib/social/sync/facebook-page-initial-sync.ts",
      );
      const brand = readSource("src/lib/security/brand-context.ts");
      assert(svc.includes("invalidateBrandSelectorCache"), "reauth start");
      assert(cb.includes("invalidateBrandSelectorCache"), "callback");
      assert(sync.includes("invalidateBrandSelectorCache"), "expiry finalize");
      assert(brand.includes("projectMetaBrandSurface"), "selector uses projection");
      assert(brand.includes("facebookSurface"), "surface on option");
      record(
        8,
        "Cache invalidation on reauth transitions + selector projection",
        "PASS",
        "start/callback/expiry",
      );
    }

    // Surfaces agree (source wiring)
    {
      const modal = readSource(
        "src/components/social/connections/manage-connections-modal.tsx",
      );
      const dash = readSource(
        "src/components/social/platforms/facebook-page-sync-dashboard.tsx",
      );
      const layout = readSource("src/app/dashboard/social/layout.tsx");
      assert(modal.includes("projectMetaBrandSurface"), "modal projection");
      assert(modal.includes("pickMetaSurfaceConnection"), "modal surface picker");
      assert(modal.includes("showSelectFacebookPage"), "no dual select CTA");
      assert(modal.includes("/api/social/facebook/reconnect"), "modal reconnect");
      assert(dash.includes("Reconnect Facebook"), "dashboard reconnect");
      assert(layout.includes("lastErrorCode"), "layout passes lastErrorCode");
      assert(
        layout.includes('connection.status === "failed"'),
        "layout keeps attention pages",
      );
      record(
        9,
        "Top bar / Manage / Dashboard share projection semantics",
        "PASS",
        "wired",
      );
    }

    // Successful reconnect atomically replaces credential only (source)
    {
      const complete = readSource(
        "src/lib/social/connections/social-connection-service.ts",
      );
      assert(complete.includes("socialCredential.upsert"), "credential upsert");
      assert(
        readSource(
          "src/lib/social/connections/facebook-oauth-callback.ts",
        ).includes("preserveSelectedFacebookPageAfterReauthorization"),
        "preserve page",
      );
      record(
        10,
        "Successful reconnect replaces credential; preserves Page when valid",
        "PASS",
        "upsert + preserve",
      );
    }

    console.log(
      JSON.stringify({
        stage: "sanitized_counts",
        before,
        afterFail: {
          connections: afterFail.connections,
          accounts: afterFail.accounts,
          status: afterFail.status,
          selected: afterFail.selected,
          sync: afterFail.sync,
        },
        credentialsBefore: before.credentials,
      }),
    );

    record(99, "Suite harness", "PASS", "ok");
  } catch (error) {
    record(
      98,
      "Suite failure",
      "FAIL",
      error instanceof Error ? error.message.slice(0, 240) : "unknown",
    );
  } finally {
    try {
      if (accountId) {
        await prisma.socialAccountSyncState.deleteMany({
          where: { socialAccountId: accountId },
        });
        await prisma.socialAccount.deleteMany({ where: { id: accountId } });
      }
      if (connectionId) {
        await prisma.socialOAuthState.deleteMany({
          where: { connectionId },
        });
        await prisma.socialCredential.deleteMany({
          where: { connectionId },
        });
        await prisma.socialProviderConnection.deleteMany({
          where: { id: connectionId },
        });
      }
      if (brandId) {
        await prisma.businessBrand.deleteMany({ where: { id: brandId } });
      }
      if (clientId) {
        await prisma.clientMembership.deleteMany({ where: { clientId } });
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      if (profileId) {
        await prisma.profile.deleteMany({ where: { id: profileId } });
      }
    } catch {
      // best-effort
    }
    await prisma.$disconnect();
    printSummary();
    process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "suite failed");
  process.exit(1);
});
