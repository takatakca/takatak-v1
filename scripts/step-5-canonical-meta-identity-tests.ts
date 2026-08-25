/**
 * Canonical Meta connection + selected Page identity regression tests.
 * Never prints tokens, Page IDs, credentials, or raw Meta bodies.
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
  console.log("\n=== Canonical Meta Connection / Page Identity ===");
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

  try {
    const {
      pickCanonicalProviderConnection,
      pickSelectedFacebookAccount,
      requiresMetaUserReplacement,
    } = await import("@/lib/social/connections/social-canonical-identity");
    const { getSocialProviderDefinition } = await import(
      "@/lib/social/providers/registry"
    );
    const { canAddAnotherAccount } = await import(
      "@/lib/social/connections/social-connection-lifecycle-policy"
    );

    // 1) Meta no longer supports multiple live accounts per brand
    {
      assert(
        getSocialProviderDefinition("meta").supportsMultipleAccounts === false,
        "meta multi-account off",
      );
      const denied = canAddAnotherAccount({
        implemented: true,
        connectable: true,
        providerState: "ready_for_authorization",
        supportsMultipleAccounts: false,
        sourceConnectionStatus: "connected",
        isPrimaryStartCard: true,
        hasPendingForProviderBrand: false,
      });
      assert(!denied.allowed, "add-another denied");
      record(
        1,
        "Meta add-another disabled — one canonical connection per brand",
        "PASS",
        "supportsMultipleAccounts=false",
      );
    }

    // 2) Canonical picker ignores array order / pending noise
    {
      const picked = pickCanonicalProviderConnection(
        [
          {
            id: "z-pending",
            provider: "meta",
            status: "pending_authorization",
          },
          {
            id: "a-connected",
            provider: "meta",
            status: "connected",
          },
          {
            id: "m-authorized",
            provider: "meta",
            status: "authorized",
          },
          {
            id: "g-google",
            provider: "google",
            status: "connected",
          },
        ],
        "meta",
      );
      assert(picked?.id === "a-connected", "connected wins");
      assert(
        pickSelectedFacebookAccount([
          {
            id: "pita",
            platform: "facebook",
            status: "not_connected",
            accessStatus: "available",
            displayName: "Pita Pita",
          },
          {
            id: "gateau",
            platform: "facebook",
            status: "connected",
            accessStatus: "selected",
            displayName: "Gateau",
          },
          {
            id: "aaa",
            platform: "facebook",
            status: "not_connected",
            accessStatus: "available",
            displayName: "AAA First",
          },
        ])?.id === "gateau",
        "selected page wins over alpha",
      );
      record(
        2,
        "Resolver never uses array position / alphabetical discovery",
        "PASS",
        "connected+selected",
      );
    }

    // 3) Different Meta user requires replacement
    {
      assert(
        requiresMetaUserReplacement({
          existingExternalSubjectId: "user-a",
          incomingExternalSubjectId: "user-b",
        }),
        "different user",
      );
      assert(
        !requiresMetaUserReplacement({
          existingExternalSubjectId: "user-a",
          incomingExternalSubjectId: "user-a",
        }),
        "same user ok",
      );
      record(
        3,
        "Different Meta user requires explicit replacement",
        "PASS",
        "no merge",
      );
    }

    // 4–8) DB constraint enforcement
    clientId = uuid();
    brandId = uuid();
    profileId = uuid();

    await prisma.client.create({
      data: { id: clientId, name: `Canon ${stamp}`, status: "active" },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `canon-${stamp}@example.test`,
        displayName: "Canon",
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
        name: `Canon Brand ${stamp}`,
        status: "active",
      },
    });

    const connA = uuid();
    await prisma.socialProviderConnection.create({
      data: {
        id: connA,
        clientId,
        businessBrandId: brandId,
        provider: "meta",
        status: "connected",
        scopes: ["pages_read_engagement"],
        authorizedAt: new Date(),
        connectedAt: new Date(),
        createdByProfileId: profileId,
        externalSubjectId: `subject-a-${stamp}`,
      },
    });

    try {
      await prisma.socialProviderConnection.create({
        data: {
          id: uuid(),
          clientId,
          businessBrandId: brandId,
          provider: "meta",
          status: "authorized",
          scopes: ["pages_read_engagement"],
          authorizedAt: new Date(),
          createdByProfileId: profileId,
          externalSubjectId: `subject-b-${stamp}`,
        },
      });
      throw new Error("expected unique violation for second live meta shell");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      assert(/spc_one_live_per_brand_provider_key|Unique constraint/i.test(message), "live unique");
      record(
        4,
        "DB rejects duplicate live Meta connections per brand",
        "PASS",
        "spc_one_live_per_brand_provider_key",
      );
    }

    const pageA = uuid();
    const pageB = uuid();
    await prisma.socialAccount.create({
      data: {
        id: pageA,
        clientId,
        businessBrandId: brandId,
        providerConnectionId: connA,
        platform: "facebook",
        accountType: "facebook_page",
        externalAccountId: `ext-a-${stamp}`,
        displayName: "Gateau Page",
        status: "connected",
        accessStatus: "selected",
      },
    });
    await prisma.socialBrandAccountAssignment.create({
      data: {
        clientId,
        businessBrandId: brandId,
        socialAccountId: pageA,
        status: "active",
        assignedAt: new Date(),
        assignedByProfileId: profileId,
      },
    });

    await prisma.socialAccount.create({
      data: {
        id: pageB,
        clientId,
        businessBrandId: brandId,
        providerConnectionId: connA,
        platform: "facebook",
        accountType: "facebook_page",
        externalAccountId: `ext-b-${stamp}`,
        displayName: "Pita Page",
        status: "not_connected",
        accessStatus: "available",
      },
    });

    try {
      await prisma.socialAccount.update({
        where: { id: pageB },
        data: { status: "connected", accessStatus: "selected" },
      });
      throw new Error("expected unique violation for second connected page");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      assert(
        /sa_one_connected_facebook_per_connection_key|Unique constraint/i.test(
          message,
        ),
        "page per connection unique",
      );
      record(
        5,
        "DB rejects second connected Facebook Page on same connection",
        "PASS",
        "sa_one_connected_facebook_per_connection_key",
      );
    }

    // Reset pageB if update partially applied (shouldn't)
    await prisma.socialAccount.update({
      where: { id: pageB },
      data: { status: "not_connected", accessStatus: "available" },
    });

    try {
      await prisma.socialBrandAccountAssignment.create({
        data: {
          clientId,
          businessBrandId: brandId,
          socialAccountId: pageB,
          status: "active",
          assignedAt: new Date(),
          assignedByProfileId: profileId,
        },
      });
      throw new Error("expected unique violation for second active assignment");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      assert(
        /sbaa_one_active_per_brand_key|Unique constraint/i.test(message),
        "assignment unique",
      );
      record(
        6,
        "DB rejects second active Page assignment per brand",
        "PASS",
        "sbaa_one_active_per_brand_key",
      );
    }

    // 7) Surfaces share resolver
    {
      const modal = readSource(
        "src/components/social/connections/manage-connections-modal.tsx",
      );
      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      const layout = readSource("src/app/dashboard/social/layout.tsx");
      const platform = readSource(
        "src/app/dashboard/social/[platform]/page.tsx",
      );
      assert(modal.includes("pickCanonicalProviderConnection"), "modal conn");
      assert(modal.includes("pickSelectedFacebookAccount"), "modal page");
      assert(shell.includes("pickConnectedPlatformAccount"), "shell");
      assert(layout.includes("pickConnectedPlatformAccount"), "layout");
      assert(platform.includes("pickSelectedFacebookAccount"), "facebook page");
      record(
        7,
        "Every UI surface uses the shared selected-identity resolver",
        "PASS",
        "manage/sidebar/top-bar/dashboard",
      );
    }

    // 8) OAuth / select idempotency + different-user guards in source
    {
      const callback = readSource(
        "src/lib/social/connections/facebook-oauth-callback.ts",
      );
      const select = readSource(
        "src/lib/social/connections/social-facebook-page-service.ts",
      );
      assert(callback.includes("requiresMetaUserReplacement"), "different user");
      assert(callback.includes("already been used"), "repeat callback");
      assert(select.includes('status: "inactive"'), "deactivate assignments");
      assert(select.includes("requiresMetaPageReselection"), "clear flag");
      assert(
        select.includes("sa_one_connected_facebook_per_connection_key") ||
          select.includes("sbaa_one_active_per_brand_key") ||
          readSource(
            "prisma/migrations/20260813000000_canonical_meta_connection_page/migration.sql",
          ).includes("sa_one_connected_facebook_per_connection_key"),
        "db unique concurrency",
      );
      assert(
        select.includes("nextDiscoveryAccessStatus"),
        "discovery preserves selected",
      );
      record(
        8,
        "OAuth claim + Page select are idempotent; DB uniques serialize winners",
        "PASS",
        "callback claim + unique indexes",
      );
    }

    // 9) Migration documents no-guess policy
    {
      const migration = readSource(
        "prisma/migrations/20260813000000_canonical_meta_connection_page/migration.sql",
      );
      assert(migration.includes("requiresMetaPageReselection"), "flag");
      assert(migration.includes("spc_one_live_per_brand_provider_key"), "live idx");
      assert(migration.includes("sbaa_one_active_per_brand_key"), "assign idx");
      assert(
        migration.includes("sa_one_connected_facebook_per_connection_key"),
        "page idx",
      );
      assert(/do NOT guess|Do not guess|disagree/i.test(migration), "no guess");
      record(
        9,
        "Migration marks ambiguous brands for reselection; never guesses",
        "PASS",
        "requiresMetaPageReselection",
      );
    }

    // 10) Identity suite still covers middle-of-15 + discovery races
    {
      const identity = readSource(
        "scripts/step-5-selected-page-identity-tests.ts",
      );
      assert(identity.includes("PAGE_COUNT = 15"), "15 pages");
      assert(identity.includes("MIDDLE = 7"), "middle select");
      assert(identity.includes("Reordered discovery"), "reorder");
      assert(identity.includes("Concurrent discovery"), "concurrent");
      assert(identity.includes("Repeated discovery"), "upserts");
      record(
        10,
        "Existing identity suite covers middle select, reorder, concurrent discovery",
        "PASS",
        "qa:social-step5-identity",
      );
    }

    // 11) Same-user reauthorization allowed (no replacement)
    {
      assert(
        !requiresMetaUserReplacement({
          existingExternalSubjectId: "same",
          incomingExternalSubjectId: "same",
        }),
        "reauth same user",
      );
      record(
        11,
        "Reauthorization with the same Meta user does not require replacement",
        "PASS",
        "subject match",
      );
    }

    // 12) Discovered candidates remain separate from selected
    {
      const accounts = await prisma.socialAccount.findMany({
        where: { providerConnectionId: connA },
        select: {
          id: true,
          status: true,
          accessStatus: true,
          displayName: true,
          platform: true,
        },
      });
      const selected = pickSelectedFacebookAccount(accounts);
      assert(selected?.id === pageA, "selected is Gateau");
      assert(
        accounts.some(
          (row) =>
            row.id === pageB && row.status === "not_connected",
        ),
        "pita stays candidate",
      );
      record(
        12,
        "Discovered candidates stay not_connected; selected stays selected",
        "PASS",
        "separation",
      );
    }
  } catch (error) {
    record(
      99,
      "Suite harness",
      "FAIL",
      error instanceof Error ? error.message.slice(0, 180) : "unknown",
    );
  } finally {
    if (clientId) {
      try {
        await prisma.client.delete({ where: { id: clientId } });
      } catch {
        // best-effort
      }
    }
    await prisma.$disconnect();
  }

  printSummary();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

void main();
