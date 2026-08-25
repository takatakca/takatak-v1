/**
 * Facebook dashboard routing / canonical resolution / reconnect CTA tests.
 * Never prints tokens, Page IDs, connection IDs, job IDs, or credentials.
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

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function printSummary() {
  console.log("\n=== Facebook Dashboard Canonical Routing ===");
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
  let clientA = "";
  let clientB = "";
  let brandA = "";
  let brandB = "";
  let profileA = "";
  let connectionA = "";
  let accountA = "";
  let accountAmbiguous = "";

  try {
    const {
      pickSelectedFacebookAccountStrict,
    } = await import("@/lib/social/connections/social-canonical-identity");
    const { resolveCanonicalFacebookDashboard } = await import(
      "@/lib/social/connections/facebook-dashboard-resolve"
    );
    const { withSocialPreview } = await import(
      "@/components/social/preview/social-preview-query"
    );

    // 1) Identifier-free routing (source)
    {
      const page = readSource("src/app/dashboard/social/[platform]/page.tsx");
      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      const syncDash = readSource(
        "src/components/social/platforms/facebook-page-sync-dashboard.tsx",
      );
      const connect = readSource(
        "src/components/social/platforms/facebook-connect-page.tsx",
      );
      assert(!page.includes("accountId"), "page has no accountId");
      assert(!shell.includes("accountId="), "shell does not append accountId");
      assert(
        !syncDash.includes("/api/social/connections/"),
        "sync uses brand-scoped API",
      );
      assert(
        syncDash.includes("/api/social/facebook/sync"),
        "sync path brand-scoped",
      );
      assert(
        syncDash.includes("Reconnect Facebook"),
        "reconnect CTA present",
      );
      assert(
        syncDash.includes("authorization_expired"),
        "expired auth gates retry",
      );
      assert(!connect.includes("connectionId"), "connect page no connectionId prop");
      record(
        1,
        "Identifier-free routing — no accountId in URL/nav; brand sync API",
        "PASS",
        "page+shell+dashboard clean",
      );
    }

    // 2) Strict picker rejects ambiguous selected Pages
    {
      const ambiguous = pickSelectedFacebookAccountStrict(
        [
          {
            id: "a",
            platform: "facebook",
            status: "connected",
            accessStatus: "selected",
          },
          {
            id: "b",
            platform: "facebook",
            status: "connected",
            accessStatus: "selected",
          },
        ],
        null,
      );
      assert(ambiguous.kind === "ambiguous", "ambiguous rejected");
      const ready = pickSelectedFacebookAccountStrict(
        [
          {
            id: "a",
            platform: "facebook",
            status: "connected",
            accessStatus: "selected",
          },
          {
            id: "b",
            platform: "facebook",
            status: "connected",
            accessStatus: "available",
          },
        ],
        null,
      );
      assert(ready.kind === "ready" && ready.account.id === "a", "unique ok");
      record(
        2,
        "Strict selected-Page picker rejects ambiguous assignments",
        "PASS",
        "ambiguous+unique",
      );
    }

    // Seed workspace fixtures
    clientA = uuid();
    clientB = uuid();
    brandA = uuid();
    brandB = uuid();
    profileA = uuid();
    connectionA = uuid();
    accountA = uuid();
    accountAmbiguous = uuid();
    const authUserA = uuid();
    const authUserB = uuid();
    const profileB = uuid();

    await prisma.profile.create({
      data: {
        id: profileA,
        authUserId: authUserA,
        email: `fb-dash-a-${stamp}@example.com`,
        role: "user",
        status: "active",
      },
    });
    await prisma.profile.create({
      data: {
        id: profileB,
        authUserId: authUserB,
        email: `fb-dash-b-${stamp}@example.com`,
        role: "user",
        status: "active",
      },
    });
    await prisma.client.create({
      data: {
        id: clientA,
        name: `FB Dash A ${stamp}`,
        status: "active",
      },
    });
    await prisma.client.create({
      data: {
        id: clientB,
        name: `FB Dash B ${stamp}`,
        status: "active",
      },
    });
    await prisma.clientMembership.create({
      data: {
        clientId: clientA,
        profileId: profileA,
        role: "owner",
        status: "active",
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: brandA,
        clientId: clientA,
        name: `Brand A ${stamp}`,
        status: "active",
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: brandB,
        clientId: clientB,
        name: `Brand B ${stamp}`,
        status: "active",
      },
    });

    await prisma.socialProviderConnection.create({
      data: {
        id: connectionA,
        clientId: clientA,
        businessBrandId: brandA,
        provider: "meta",
        status: "connected",
        createdByProfileId: profileA,
        scopes: ["pages_read_engagement"],
        authorizedAt: new Date(),
        connectedAt: new Date(),
        externalSubjectId: `subject-a-${stamp}`,
      },
    });

    await prisma.socialAccount.create({
      data: {
        id: accountA,
        clientId: clientA,
        businessBrandId: brandA,
        providerConnectionId: connectionA,
        platform: "facebook",
        accountType: "facebook_page",
        status: "connected",
        accessStatus: "selected",
        displayName: "Canonical Page",
        externalAccountId: `ext_${stamp}_a`,
      },
    });

    // 3) Server-side canonical resolution
    {
      const ready = await resolveCanonicalFacebookDashboard({
        clientId: clientA,
        businessBrandId: brandA,
      });
      assert(ready.kind === "ready", "ready for owner");
      assert(ready.kind === "ready" && ready.pageName === "Canonical Page", "name");
      // Internal ids exist but must not leak via withSocialPreview / routing helpers.
      const href = withSocialPreview(
        "/dashboard/social/facebook?accountId=should-be-stripped",
        new URLSearchParams("preview=subscribed"),
      );
      assert(!href.includes("accountId"), "preview strips accountId");
      assert(href.includes("preview=subscribed"), "preview kept");
      record(
        3,
        "Server-side canonical resolution for workspace brand",
        "PASS",
        "ready + accountId stripped",
      );
    }

    // 4) Cross-brand / unauthorized client cannot resolve foreign brand
    {
      const cross = await resolveCanonicalFacebookDashboard({
        clientId: clientB,
        businessBrandId: brandA,
      });
      assert(cross.kind === "missing", "foreign brand missing");
      const otherBrand = await resolveCanonicalFacebookDashboard({
        clientId: clientA,
        businessBrandId: brandB,
      });
      assert(otherBrand.kind === "missing", "other client brand missing");
      record(
        4,
        "Unauthorized cross-brand access resolves safely to missing",
        "PASS",
        "clientB→brandA + clientA→brandB",
      );
    }

    // 5) Ambiguous selected Pages rejected (picker) + resolve missing when unselected
    {
      await prisma.socialAccount.update({
        where: { id: accountA },
        data: { accessStatus: "available" },
      });
      const missing = await resolveCanonicalFacebookDashboard({
        clientId: clientA,
        businessBrandId: brandA,
      });
      assert(missing.kind === "missing", "unselected → missing");

      const resolveSrc = readSource(
        "src/lib/social/connections/facebook-dashboard-resolve.ts",
      );
      assert(
        resolveSrc.includes("pickSelectedFacebookAccountStrict"),
        "uses strict picker",
      );
      assert(resolveSrc.includes('"ambiguous"'), "returns ambiguous");
      record(
        5,
        "Ambiguous selected assignments rejected safely",
        "PASS",
        "strict picker + missing when unselected",
      );
      await prisma.socialAccount.update({
        where: { id: accountA },
        data: { accessStatus: "selected" },
      });
    }

    // 6) Expired-authorization action selection (source + POST guard)
    {
      const syncRoute = readSource(
        "src/app/api/social/facebook/sync/route.ts",
      );
      const reconnect = readSource(
        "src/app/api/social/facebook/reconnect/route.ts",
      );
      assert(
        syncRoute.includes('authorization_expired'),
        "POST checks expired auth",
      );
      assert(
        syncRoute.includes("canRetryWithCurrentCredential"),
        "allows retry when shell connected",
      );
      assert(
        syncRoute.includes("409"),
        "returns conflict when shell unusable",
      );
      assert(
        reconnect.includes("startMetaFacebookReauthorization"),
        "reconnect API",
      );
      assert(
        !reconnect.includes("enqueueInitialFacebookPageSync"),
        "reconnect does not enqueue sync",
      );
      const dash = readSource(
        "src/components/social/platforms/facebook-page-sync-dashboard.tsx",
      );
      assert(
        dash.includes("needsReconnect") ||
          dash.includes("authorization_expired"),
        "UI gates reconnect",
      );
      assert(dash.includes("Reconnect Facebook"), "reconnect CTA");
      assert(dash.includes("Retry sync"), "retry CTA beside reconnect");
      assert(
        dash.includes('"/api/social/facebook/reconnect"'),
        "reconnect endpoint",
      );
      record(
        6,
        "authorization_expired: Reconnect + Retry when shell connected",
        "PASS",
        "UI+API guards",
      );
    }

    // 7) Preserve-after-reauth live validation wiring
    {
      const callback = readSource(
        "src/lib/social/connections/facebook-oauth-callback.ts",
      );
      const service = readSource(
        "src/lib/social/connections/social-facebook-page-service.ts",
      );
      assert(
        callback.includes("preserveSelectedFacebookPageAfterReauthorization"),
        "callback preserve",
      );
      assert(
        service.includes("revalidateManagedFacebookPage"),
        "live validate",
      );
      assert(
        service.includes("requires_selection"),
        "requires explicit select on failure",
      );
      record(
        7,
        "Post-reauth preserves Page only after live validation",
        "PASS",
        "preserve+demote wired",
      );
    }

    record(99, "Suite harness", "PASS", "ok");
  } catch (error) {
    record(
      98,
      "Suite failure",
      "FAIL",
      error instanceof Error ? error.message : "unknown",
    );
  } finally {
    try {
      if (accountAmbiguous) {
        await prisma.socialAccount.deleteMany({
          where: { id: accountAmbiguous },
        });
      }
      if (accountA) {
        await prisma.socialAccount.deleteMany({ where: { id: accountA } });
      }
      if (connectionA) {
        await prisma.socialProviderConnection.deleteMany({
          where: { id: connectionA },
        });
      }
      if (brandA) {
        await prisma.businessBrand.deleteMany({ where: { id: brandA } });
      }
      if (brandB) {
        await prisma.businessBrand.deleteMany({ where: { id: brandB } });
      }
      if (clientA) {
        await prisma.clientMembership.deleteMany({
          where: { clientId: clientA },
        });
        await prisma.client.deleteMany({ where: { id: clientA } });
      }
      if (clientB) {
        await prisma.client.deleteMany({ where: { id: clientB } });
      }
      if (profileA) {
        await prisma.profile.deleteMany({
          where: {
            email: {
              in: [
                `fb-dash-a-${stamp}@example.com`,
                `fb-dash-b-${stamp}@example.com`,
              ],
            },
          },
        });
      }
    } catch {
      // best-effort cleanup
    }
    await prisma.$disconnect();
    printSummary();
    const failed = results.filter((r) => r.status === "FAIL").length;
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "suite failed");
  process.exit(1);
});
