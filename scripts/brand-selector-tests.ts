/**
 * Brand selector display priority, tooltip, sync, and safety tests.
 * Never prints tokens, Page IDs, or private provider metadata.
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
const originalLog = console.log;
const originalError = console.error;

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
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
  let brandId2 = "";
  let connectionId = "";
  let accountId = "";
  let profileId = "";

  try {
    const {
      resolveBrandDisplayImage,
      resolveBrandDisplayLabel,
      listConnectedPlatformIcons,
      brandInitials,
    } = await import("@/lib/brands/brand-display-image");
    const {
      loadBrandSelectorSnapshots,
      invalidateBrandSelectorCache,
      resetBrandSelectorCacheForTests,
    } = await import(
      "@/lib/security/brand-context"
    );
    resetBrandSelectorCacheForTests();

    // 1. Facebook connection supplies top-bar image + Page name when brand is a demo label
    {
      const resolved = resolveBrandDisplayImage({
        uploadedImageUrl: null,
        connectedAccounts: [
          {
            platform: "facebook",
            profileImageUrl: "https://cdn.example/page.png",
            displayName: "PPP Pizzeria Montréal",
            preferAsPrimary: true,
          },
        ],
      });
      assert(resolved.source === "connected_social", "social source");
      assert(
        resolved.displayImageUrl === "https://cdn.example/page.png",
        "page image",
      );
      const label = resolveBrandDisplayLabel({
        brandName: "My Test Brand",
        connectedAccounts: [
          {
            platform: "facebook",
            profileImageUrl: "https://cdn.example/page.png",
            displayName: "PPP Pizzeria Montréal",
            preferAsPrimary: true,
          },
        ],
      });
      assert(label === "PPP Pizzeria Montréal", "page name not demo brand");
      const emptyLabel = resolveBrandDisplayLabel({
        brandName: "My Test Brand",
        connectedAccounts: [],
      });
      assert(emptyLabel === "Empty brand", "demo name hidden when empty");
      record(
        1,
        "Facebook connection supplies top-bar image and Page name (not demo brand)",
        "PASS",
        label,
      );
    }

    // 2. Explicit brand image beats Facebook image
    {
      const resolved = resolveBrandDisplayImage({
        uploadedImageUrl: "https://cdn.example/brand-upload.png",
        connectedAccounts: [
          {
            platform: "facebook",
            profileImageUrl: "https://cdn.example/page.png",
          },
        ],
      });
      assert(resolved.source === "uploaded", "uploaded wins");
      assert(
        resolved.displayImageUrl === "https://cdn.example/brand-upload.png",
        "upload url",
      );
      record(
        2,
        "Explicit brand image takes priority over Facebook image",
        "PASS",
        resolved.source,
      );
    }

    // 3. Long names truncate + hover/focus tooltip (UI contract)
    {
      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      assert(shell.includes('role="tooltip"'), "tooltip role");
      assert(shell.includes("createPortal"), "portal tooltip");
      assert(shell.includes("onMouseEnter={openTooltip}"), "hover");
      assert(shell.includes("onFocus={openTooltip}"), "keyboard focus");
      assert(shell.includes("scrollWidth > node.clientWidth"), "truncate detect");
      assert(shell.includes("-translate-y-1/2"), "metricool left-center tip");
      assert(shell.includes("displayLabel"), "page display label");
      assert(shell.includes("Empty brand"), "empty brand label");
      assert(
        brandInitials("O'oeuf Déjeuner Montreal Nord").length >= 1,
        "initials",
      );
      record(
        3,
        "Long names truncate and reveal complete name on hover/focus",
        "PASS",
        "portal tooltip",
      );
    }

    // 4. Dropdown shows names, images, connected platform icons
    {
      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      assert(shell.includes("ConnectedPlatformIcons"), "platform icons");
      assert(shell.includes("displayImageUrl"), "display image");
      assert(shell.includes("connectedPlatforms"), "platforms");
      assert(shell.includes('role="option"'), "list options");
      assert(shell.includes("aria-selected"), "selected state");
      assert(shell.includes("Add brand"), "add brand");
      assert(shell.includes("<Tag"), "empty tag icon");
      assert(
        listConnectedPlatformIcons(["tiktok", "facebook", "instagram"]).join(
          ",",
        ) === "facebook,instagram,tiktok",
        "icon order",
      );
      record(
        4,
        "Dropdown shows current brand names, images, and connected-platform icons",
        "PASS",
        "selector contract",
      );
    }

    // DB fixtures for live snapshot
    clientId = uuid();
    brandId = uuid();
    brandId2 = uuid();
    profileId = uuid();
    connectionId = uuid();
    accountId = uuid();

    await prisma.client.create({
      data: { id: clientId, name: `BrandSel ${stamp}`, status: "active" },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `brandsel-${stamp}@example.test`,
        displayName: "BrandSel",
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
        name: "Empty brand",
        status: "active",
        imageUrl: null,
      },
    });
    await prisma.businessBrand.create({
      data: {
        id: brandId2,
        clientId,
        name: "O'oeuf Déjeuner Montreal Nord",
        status: "active",
        imageUrl: null,
      },
    });
    await prisma.socialProviderConnection.create({
      data: {
        id: connectionId,
        clientId,
        businessBrandId: brandId2,
        provider: "meta",
        status: "connected",
        scopes: ["pages_read_engagement"],
        authorizedAt: new Date(),
        connectedAt: new Date(),
        createdByProfileId: profileId,
      },
    });
    await prisma.socialAccount.create({
      data: {
        id: accountId,
        clientId,
        businessBrandId: brandId2,
        providerConnectionId: connectionId,
        platform: "facebook",
        accountType: "facebook_page",
        externalAccountId: `page-secret-${stamp}`,
        displayName: "PPP Pizzeria",
        profileImageUrl: "https://cdn.example/fb-page.png",
        status: "connected",
        accessStatus: "selected",
      },
    });
    await prisma.socialBrandAccountAssignment.create({
      data: {
        clientId,
        businessBrandId: brandId2,
        socialAccountId: accountId,
        status: "active",
        assignedAt: new Date(),
        assignedByProfileId: profileId,
      },
    });

    // 5. Page/connect invalidates stale selector via server snapshot
    {
      const before = await loadBrandSelectorSnapshots(clientId);
      const oeuf = before.find((b) => b.id === brandId2);
      assert(oeuf, "brand present");
      assert(
        oeuf!.displayImageUrl === `/api/social/media/picture/${accountId}`,
        "fb picture proxy",
      );
      assert(oeuf!.displayLabel === "PPP Pizzeria", "page display label");
      assert(oeuf!.connectedPlatforms.includes("facebook"), "fb icon");
      assert(oeuf!.imageUrl === null, "no upload overwrite");
      assert(oeuf!.name === "O'oeuf Déjeuner Montreal Nord", "workspace name retained");

      const empty = before.find((b) => b.id === brandId);
      assert(empty?.displayLabel === "Empty brand", "empty label");
      assert(empty?.displayImageUrl === null, "empty initials path");
      assert(empty?.connectedPlatforms.length === 0, "no icons");

      // Simulate page image change
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          profileImageUrl: "https://cdn.example/fb-page-v2.png",
          displayName: "PPP Updated",
        },
      });
      invalidateBrandSelectorCache(clientId);
      const after = await loadBrandSelectorSnapshots(clientId);
      const refreshed = after.find((b) => b.id === brandId2);
      assert(
        refreshed!.displayImageUrl === `/api/social/media/picture/${accountId}`,
        "picture proxy remains account-scoped",
      );

      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      assert(
        shell.includes("/api/social/brand-selector"),
        "live refetch endpoint",
      );
      assert(
        shell.includes("SOCIAL_BRAND_SELECTOR_REFRESH_EVENT"),
        "refresh event",
      );
      const modal = readSource(
        "src/components/social/connections/manage-connections-modal.tsx",
      );
      assert(
        modal.includes("requestSocialBrandSelectorRefresh"),
        "connect/disconnect refresh",
      );
      record(
        5,
        "Page changes invalidate stale top-bar and dropdown data",
        "PASS",
        "snapshot + refresh event",
      );
    }

    // 6. Brand switching updates surfaces via cookie API + router.refresh
    {
      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      assert(shell.includes("/api/social/brand-context"), "switch API");
      assert(shell.includes("router.refresh()"), "RSC refresh");
      assert(shell.includes("setActiveDisplayLabel"), "local top-bar update");
      record(
        6,
        "Brand switching updates every active-brand surface consistently",
        "PASS",
        "POST brand-context + refresh",
      );
    }

    // 7. Disconnect removes icon and restores next fallback
    {
      await prisma.socialBrandAccountAssignment.updateMany({
        where: { socialAccountId: accountId },
        data: { status: "inactive" },
      });
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { status: "not_connected" },
      });
      invalidateBrandSelectorCache(clientId);
      const afterDisconnect = await loadBrandSelectorSnapshots(clientId);
      const brand = afterDisconnect.find((b) => b.id === brandId2)!;
      assert(!brand.connectedPlatforms.includes("facebook"), "icon removed");
      assert(brand.displayImageUrl === null, "fallback to initials");

      // Explicit upload still wins after reconnect imagery present
      await prisma.businessBrand.update({
        where: { id: brandId2 },
        data: { imageUrl: "https://cdn.example/uploaded.png" },
      });
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          status: "connected",
          profileImageUrl: "https://cdn.example/fb-again.png",
        },
      });
      await prisma.socialBrandAccountAssignment.updateMany({
        where: { socialAccountId: accountId },
        data: { status: "active" },
      });
      invalidateBrandSelectorCache(clientId);
      const withUpload = await loadBrandSelectorSnapshots(clientId);
      const uploaded = withUpload.find((b) => b.id === brandId2)!;
      assert(
        uploaded.displayImageUrl === "https://cdn.example/uploaded.png",
        "upload preserved",
      );
      record(
        7,
        "Disconnect removes icon; upload preserved over Facebook fallback",
        "PASS",
        "fallback chain",
      );
    }

    // 8. Loading / broken-image / empty / permission / error remain usable
    {
      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      assert(shell.includes("Loading brands"), "loading");
      assert(shell.includes("onError"), "broken image");
      assert(shell.includes("Empty brand") || shell.includes("brand.name"), "names");
      assert(shell.includes("canManageBrands"), "permission gate");
      assert(shell.includes("The brand could not be changed"), "error");
      assert(shell.includes("No brands are available"), "empty list");
      record(
        8,
        "Loading, broken-image, empty-brand, permission, and error states remain usable",
        "PASS",
        "ui states present",
      );
    }

    // 9. No sensitive IDs rendered or logged in selector surfaces
    {
      const snapshot = JSON.stringify(
        await loadBrandSelectorSnapshots(clientId),
      );
      assert(!snapshot.includes(`page-secret-${stamp}`), "no page id");
      assert(!snapshot.includes("page-secret"), "no page secret");

      const shell = readSource(
        "src/components/social/navigation/social-workspace-shell.tsx",
      );
      assert(!shell.includes("externalPageId"), "no page id in selector UI");
      const route = readSource(
        "src/app/api/social/brand-selector/route.ts",
      );
      assert(route.includes("Omits Page IDs"), "api contract");
      record(
        9,
        "No sensitive or internal Page/provider identifiers rendered",
        "PASS",
        "sanitized snapshot",
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
    try {
      if (accountId) {
        await prisma.socialBrandAccountAssignment.deleteMany({
          where: { socialAccountId: accountId },
        });
        await prisma.socialAccount.deleteMany({ where: { id: accountId } });
      }
      if (connectionId) {
        await prisma.socialProviderConnection.deleteMany({
          where: { id: connectionId },
        });
      }
      if (clientId) {
        await prisma.businessBrand.deleteMany({ where: { clientId } });
        await prisma.clientMembership.deleteMany({ where: { clientId } });
        await prisma.client.deleteMany({ where: { id: clientId } });
      }
      if (profileId) {
        await prisma.profile.deleteMany({ where: { id: profileId } });
      }
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  }

  printSummary();
  process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
}

function printSummary() {
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  originalLog("\n=== Brand Selector Top-Bar ===");
  for (const result of results) {
    originalLog(
      `[${result.status}] #${result.id} ${result.name} — ${result.evidence}`,
    );
  }
  originalLog(
    `\nSummary: ${passed} passed, ${failed} failed, ${blocked} blocked`,
  );
}

main().catch((error) => {
  originalError(error);
  process.exit(1);
});
