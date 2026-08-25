/**
 * Selected Facebook Page identity binding tests.
 * Never prints tokens, Page IDs, connection IDs, or raw Meta bodies.
 *
 * Root cause under test: dashboard surfaces must resolve the persisted
 * selected Page — never alphabetical discovery order / first Facebook row.
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type Status = "PASS" | "FAIL" | "BLOCKED";
type Result = { id: number; name: string; status: Status; evidence: string };

type PageMock = {
  id: string;
  name: string;
  category?: string;
  pictureUrl?: string;
  access_token?: string | null;
  tasks?: string[];
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
const originalFetch = globalThis.fetch;
const originalLog = console.log;
const originalError = console.error;

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function printSummary() {
  console.log("\n=== Selected Facebook Page Identity ===");
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

function sanitizeEvidence(value: string): string {
  return value
    .replace(/page-[a-z0-9-]+/gi, "[page]")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "[id]",
    )
    .replace(/SYNTH_[A-Z0-9_]+/g, "[token]");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    record(0, "database", "BLOCKED", "DATABASE_URL missing");
    printSummary();
    process.exit(1);
  }

  if (!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY) {
    // Deterministic local test key (32 bytes base64) — not a production secret.
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
  }

  const prisma = new PrismaClient();
  const stamp = Date.now().toString(36);
  let clientId = "";
  let brandId = "";
  let profileId = "";
  let connectionId = "";
  let mockPages: PageMock[] = [];

  function installMetaFetchMock() {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

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
        return jsonResponse({
          data: mockPages.map((page) => ({
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
            tasks: page.tasks ?? ["MANAGE", "CREATE_CONTENT", "MODERATE"],
          })),
        });
      }

      // Page revalidation hits /{page-id}?fields=...
      const pageMatch = mockPages.find((page) =>
        url.pathname.includes(`/${page.id}`),
      );
      if (pageMatch) {
        return jsonResponse({
          id: pageMatch.id,
          name: pageMatch.name,
          category: pageMatch.category ?? "Brand",
          picture: pageMatch.pictureUrl
            ? { data: { url: pageMatch.pictureUrl } }
            : undefined,
          access_token:
            pageMatch.access_token ?? `SYNTH_PAGE_TOKEN_${pageMatch.id}`,
          tasks: pageMatch.tasks ?? ["MANAGE", "CREATE_CONTENT", "MODERATE"],
        });
      }

      return jsonResponse({ error: { message: "unexpected", code: 1 } }, 500);
    }) as typeof fetch;
  }

  try {
    const {
      buildSocialCredentialAad,
      encryptSocialTokenPayload,
      decryptSocialTokenPayload,
      readMetaFacebookPageCredential,
    } = await import("@/lib/social/security/social-crypto");
    const {
      discoverFacebookPages,
      selectFacebookPage,
    } = await import(
      "@/lib/social/connections/social-facebook-page-service"
    );
    const { getSocialConnectionsData } = await import(
      "@/lib/social/connections/social-connection-data"
    );
    const { loadBrandSelectorSnapshots } = await import(
      "@/lib/security/brand-context"
    );
    const {
      pickSelectedFacebookAccount,
      pickConnectedPlatformAccount,
    } = await import(
      "@/lib/social/connections/social-selected-page-identity"
    );
    const {
      resolveBrandDisplayImage,
      resolveBrandDisplayLabel,
    } = await import("@/lib/brands/brand-display-image");

    clientId = uuid();
    brandId = uuid();
    profileId = uuid();

    await prisma.client.create({
      data: { id: clientId, name: `SelId ${stamp}`, status: "active" },
    });
    await prisma.profile.create({
      data: {
        id: profileId,
        authUserId: uuid(),
        email: `selid-${stamp}@example.test`,
        displayName: "SelId",
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
        name: "My Test Brand",
        status: "active",
        imageUrl: null,
      },
    });

    connectionId = uuid();
    const encrypted = encryptSocialTokenPayload(
      {
        accessToken: "SYNTH_USER_TOKEN",
        scopes: ["pages_show_list", "pages_read_engagement"],
        providerAccountId: "meta-user-selid",
      },
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
        status: "authorized",
        scopes: ["pages_show_list", "pages_read_engagement"],
        authorizedAt: new Date(),
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

    // 15 pages; middle index 7 is the confirmed choice (Gateau-like).
    const PAGE_COUNT = 15;
    const MIDDLE = 7;
    mockPages = Array.from({ length: PAGE_COUNT }, (_, index) => {
      const n = index + 1;
      if (index === 0) {
        return {
          id: `page-pita-${stamp}`,
          name: "Pita Pita Montréal",
          pictureUrl: "https://cdn.example/pita.png",
        };
      }
      if (index === MIDDLE) {
        return {
          id: `page-gateau-${stamp}`,
          name: "Gateau et viennoise Montréal – Notre Dame de Grâce",
          pictureUrl: "https://cdn.example/gateau.png",
        };
      }
      return {
        id: `page-${n}-${stamp}`,
        name: `Discovered Page ${String(n).padStart(2, "0")}`,
        pictureUrl: `https://cdn.example/p${n}.png`,
      };
    });

    const targetName =
      "Gateau et viennoise Montréal – Notre Dame de Grâce";
    const targetImage = "https://cdn.example/gateau.png";
    const wrongName = "Pita Pita Montréal";

    // ---- Unit: pickers never use alphabetical / first discovery row ----
    {
      const shuffled = [
        {
          id: "a",
          platform: "facebook",
          status: "not_connected",
          accessStatus: "available",
          displayName: wrongName,
        },
        {
          id: "b",
          platform: "facebook",
          status: "connected",
          accessStatus: "selected",
          displayName: targetName,
          profileImageUrl: targetImage,
        },
        {
          id: "c",
          platform: "facebook",
          status: "not_connected",
          accessStatus: "available",
          displayName: "AAA First Alpha",
        },
      ];
      const picked = pickSelectedFacebookAccount(shuffled);
      assert(picked?.displayName === targetName, "picker selected page");
      assert(
        pickConnectedPlatformAccount(shuffled, "facebook")?.id === "b",
        "platform picker",
      );
      record(
        1,
        "Identity picker ignores alphabetical discovery rows",
        "PASS",
        "selected+connected wins",
      );
    }

    // ---- Discover 15 pages ----
    installMetaFetchMock();
    const discovery = await discoverFacebookPages({
      clientId,
      profileId,
      connectionId,
    });
    assert(discovery.pages.length === PAGE_COUNT, "15 pages");
    const middle = discovery.pages[MIDDLE]!;
    assert(middle.name === targetName, "middle is Gateau");
    const middleSocialAccountId = middle.socialAccountId;

    record(
      2,
      "Discovery lists 15 Pages without selecting any",
      "PASS",
      `count=${discovery.pages.length}`,
    );

    // ---- Select middle entry only ----
    installMetaFetchMock();
    const selection = await selectFacebookPage({
      clientId,
      profileId,
      connectionId,
      socialAccountId: middleSocialAccountId,
    });

    assert(selection.socialAccountId === middleSocialAccountId, "same id");
    assert(selection.pageName === targetName, "selection response name");
    assert(selection.profileImageUrl === targetImage, "selection image");
    assert(selection.connectionStatus === "connected", "connected");
    assert(!selection.pageName.includes(wrongName), "not pita");
    record(
      3,
      "Selection response returns exact middle Page identity",
      "PASS",
      "name+image+socialAccountId",
    );

    // ---- Persisted connection / credential / account ----
    {
      const account = await prisma.socialAccount.findUniqueOrThrow({
        where: { id: middleSocialAccountId },
        select: {
          displayName: true,
          profileImageUrl: true,
          status: true,
          accessStatus: true,
          businessBrandId: true,
          externalAccountId: true,
        },
      });
      assert(account.displayName === targetName, "persisted name");
      assert(account.profileImageUrl === targetImage, "persisted image");
      assert(account.status === "connected", "persisted status");
      assert(account.accessStatus === "selected", "persisted selected");
      assert(account.businessBrandId === brandId, "brand bound");

      const connection = await prisma.socialProviderConnection.findUniqueOrThrow(
        {
          where: { id: connectionId },
          select: {
            status: true,
            displayName: true,
            credential: {
              select: {
                encryptedPayload: true,
                iv: true,
                authTag: true,
                keyVersion: true,
                status: true,
              },
            },
          },
        },
      );
      assert(connection.status === "connected", "shell connected");
      assert(connection.displayName === targetName, "shell name");
      assert(connection.credential, "credential present");

      const payload = decryptSocialTokenPayload(
        {
          ciphertext: connection.credential!.encryptedPayload,
          iv: connection.credential!.iv,
          authTag: connection.credential!.authTag,
          keyVersion: connection.credential!.keyVersion,
        },
        buildSocialCredentialAad({
          clientId,
          connectionId,
          provider: "meta",
        }),
      );
      const pageCredential = readMetaFacebookPageCredential(payload);
      assert(
        pageCredential?.pageId === account.externalAccountId,
        "credential pageId matches selected account",
      );

      const siblings = await prisma.socialAccount.findMany({
        where: {
          providerConnectionId: connectionId,
          platform: "facebook",
          id: { not: middleSocialAccountId },
        },
        select: { status: true, accessStatus: true, displayName: true },
      });
      assert(
        siblings.every(
          (row) =>
            row.status !== "connected" && row.accessStatus !== "selected",
        ),
        "no sibling selected/connected",
      );
      assert(
        siblings.some((row) => row.displayName === wrongName),
        "pita remains discovered only",
      );

      record(
        4,
        "Persisted connection binds selected Page + credential atomically",
        "PASS",
        "shell+account+credential aligned",
      );
    }

    // ---- Manage connections list ----
    {
      const connections = await getSocialConnectionsData(clientId, brandId);
      const meta = connections.find((row) => row.id === connectionId);
      assert(meta, "meta connection");
      const selected = pickSelectedFacebookAccount(meta!.accounts);
      assert(selected?.displayName === targetName, "manage identity");
      assert(selected?.id === middleSocialAccountId, "manage account id");
      assert(selected?.profileImageUrl === targetImage, "manage image");
      // Alphabetical first Facebook must NOT win.
      const alphaFirst = [...meta!.accounts]
        .filter((a) => a.platform === "facebook")
        .sort((a, b) =>
          (a.displayName ?? "").localeCompare(b.displayName ?? ""),
        )[0];
      assert(
        alphaFirst?.displayName !== selected?.displayName ||
          alphaFirst?.status === "connected",
        "picker not forced to alpha",
      );
      record(
        5,
        "Manage connections resolves persisted selected Page",
        "PASS",
        "not alphabetical discovery",
      );
    }

    // ---- Brand selector / top-bar fallback ----
    {
      const brands = await loadBrandSelectorSnapshots(clientId);
      const brand = brands.find((row) => row.id === brandId);
      assert(brand?.displayLabel === targetName, "top-bar name");
      assert(brand?.displayImageUrl === targetImage, "top-bar image");
      assert(brand?.name === "My Test Brand", "workspace name retained");

      const uploaded = resolveBrandDisplayImage({
        uploadedImageUrl: "https://cdn.example/brand-upload.png",
        connectedAccounts: [
          {
            platform: "facebook",
            profileImageUrl: targetImage,
            displayName: targetName,
            preferAsPrimary: true,
          },
        ],
      });
      assert(uploaded.source === "uploaded", "upload beats page image");
      assert(
        resolveBrandDisplayLabel({
          brandName: "My Test Brand",
          connectedAccounts: [
            {
              platform: "facebook",
              profileImageUrl: targetImage,
              displayName: targetName,
              preferAsPrimary: true,
            },
            {
              platform: "facebook",
              profileImageUrl: "https://cdn.example/pita.png",
              displayName: wrongName,
              preferAsPrimary: false,
            },
          ],
        }) === targetName,
        "preferAsPrimary beats sibling facebook",
      );

      record(
        6,
        "Top-bar / brand selector use selected Page name and image",
        "PASS",
        "Gateau identity",
      );
    }

    // ---- Sidebar / dashboard data source (connected accounts ordering) ----
    {
      const connections = await getSocialConnectionsData(clientId, brandId);
      const connected = connections.flatMap((row) =>
        row.status === "connected"
          ? row.accounts.filter((a) => a.status === "connected")
          : [],
      );
      const sidebar = pickConnectedPlatformAccount(connected, "facebook");
      assert(sidebar?.displayName === targetName, "sidebar identity");
      assert(sidebar?.id === middleSocialAccountId, "sidebar id");
      record(
        7,
        "Facebook sidebar identity uses persisted selected Page",
        "PASS",
        "Gateau",
      );
    }

    // ---- Reload / re-query (server restart simulation) ----
    {
      const brands = await loadBrandSelectorSnapshots(clientId);
      const brand = brands.find((row) => row.id === brandId);
      assert(brand?.displayLabel === targetName, "reload label");
      assert(brand?.displayImageUrl === targetImage, "reload image");
      const account = await prisma.socialAccount.findUniqueOrThrow({
        where: { id: middleSocialAccountId },
        select: { displayName: true, accessStatus: true, status: true },
      });
      assert(account.displayName === targetName, "reload account");
      assert(account.accessStatus === "selected", "reload selected");
      record(
        8,
        "State survives reload / fresh server queries",
        "PASS",
        "persisted",
      );
    }

    // ---- Reordered discovery must not overwrite selected identity ----
    {
      const reordered = [...mockPages].reverse();
      mockPages = reordered;
      installMetaFetchMock();
      const again = await discoverFacebookPages({
        clientId,
        profileId,
        connectionId,
      });
      assert(again.pages.length === PAGE_COUNT, "still 15");
      const current = again.pages.find((page) => page.isCurrentSelection);
      assert(current?.name === targetName, "current selection marker");
      assert(current?.socialAccountId === middleSocialAccountId, "same row");

      const account = await prisma.socialAccount.findUniqueOrThrow({
        where: { id: middleSocialAccountId },
        select: {
          displayName: true,
          profileImageUrl: true,
          status: true,
          accessStatus: true,
        },
      });
      assert(account.accessStatus === "selected", "selected preserved");
      assert(account.status === "connected", "connected preserved");
      assert(account.displayName === targetName, "name preserved");
      assert(account.profileImageUrl === targetImage, "image preserved");

      const brands = await loadBrandSelectorSnapshots(clientId);
      assert(
        brands.find((b) => b.id === brandId)?.displayLabel === targetName,
        "top-bar still Gateau after reorder",
      );
      record(
        9,
        "Reordered discovery cannot overwrite selected Page fields",
        "PASS",
        "accessStatus=selected kept",
      );
    }

    // ---- Repeated upserts ----
    {
      installMetaFetchMock();
      await discoverFacebookPages({ clientId, profileId, connectionId });
      await discoverFacebookPages({ clientId, profileId, connectionId });
      const account = await prisma.socialAccount.findUniqueOrThrow({
        where: { id: middleSocialAccountId },
        select: { accessStatus: true, status: true, displayName: true },
      });
      assert(account.accessStatus === "selected", "still selected");
      assert(account.displayName === targetName, "still Gateau");
      record(
        10,
        "Repeated discovery upserts leave selected Page intact",
        "PASS",
        "idempotent",
      );
    }

    // ---- Concurrent discovery + identity read ----
    {
      installMetaFetchMock();
      const [d1, d2, brands] = await Promise.all([
        discoverFacebookPages({ clientId, profileId, connectionId }),
        discoverFacebookPages({ clientId, profileId, connectionId }),
        loadBrandSelectorSnapshots(clientId),
      ]);
      assert(d1.pages.length === PAGE_COUNT, "d1");
      assert(d2.pages.length === PAGE_COUNT, "d2");
      assert(
        brands.find((b) => b.id === brandId)?.displayLabel === targetName,
        "concurrent brand label",
      );
      record(
        11,
        "Concurrent discovery and brand snapshot stay on selected Page",
        "PASS",
        "no race to Pita",
      );
    }

    // ---- Changing Pages requires explicit new selection (conflict when connected) ----
    {
      const pita = discovery.pages[0]!;
      assert(pita.name === wrongName, "pita is first discovery entry");
      try {
        await selectFacebookPage({
          clientId,
          profileId,
          connectionId,
          socialAccountId: pita.socialAccountId,
        });
        throw new Error("expected conflict when already connected");
      } catch (error) {
        assert(
          error instanceof Error &&
            /already has a selected Facebook Page/i.test(error.message),
          "change blocked without disconnect flow",
        );
      }
      const brands = await loadBrandSelectorSnapshots(clientId);
      assert(
        brands.find((b) => b.id === brandId)?.displayLabel === targetName,
        "still Gateau after rejected change",
      );
      record(
        12,
        "Changing Pages without disconnect is rejected; identity unchanged",
        "PASS",
        "conflict",
      );
    }

    // ---- Cancellation without saving (source contract) ----
    {
      const panel = readSource(
        "src/components/social/connections/facebook-page-selection-panel.tsx",
      );
      assert(panel.includes("isCurrentSelection"), "shows current choice");
      assert(
        panel.includes("setSelectedId(current?.socialAccountId"),
        "preselect persisted",
      );
      assert(panel.includes("confirmSelection"), "explicit confirm");
      assert(panel.includes("onClose"), "cancel path");
      // Closing must not POST select.
      assert(
        !panel.includes("onClose={() => {\n    void confirmSelection"),
        "close does not save",
      );
      record(
        13,
        "Reopen may highlight persisted Page; cancel does not save another",
        "PASS",
        "confirm-only save",
      );
    }

    // ---- Cache invalidation / refresh wiring ----
    {
      const modal = readSource(
        "src/components/social/connections/manage-connections-modal.tsx",
      );
      const route = readSource(
        "src/app/api/social/connections/[connectionId]/pages/select/route.ts",
      );
      assert(modal.includes("requestSocialBrandSelectorRefresh"), "brand refresh");
      assert(modal.includes("router.refresh()"), "rsc refresh");
      assert(modal.includes("refreshConnectionsFromServer"), "connections refresh");
      assert(modal.includes("pickSelectedFacebookAccount"), "manage picker");
      assert(route.includes("revalidatePath(\"/dashboard/social\")"), "revalidate");
      assert(route.includes("profileImageUrl"), "response image");
      assert(
        !route.includes("externalPageId: selection.externalPageId"),
        "page id omitted from client",
      );
      record(
        14,
        "Post-select invalidates connections, brand selector, and RSC paths",
        "PASS",
        "refresh wired",
      );
    }

    // ---- Safety: no secrets in sources / evidence ----
    {
      const identity = readSource(
        "src/lib/social/connections/social-selected-page-identity.ts",
      );
      assert(identity.includes("pickSelectedFacebookAccount"), "helper");
      const service = readSource(
        "src/lib/social/connections/social-facebook-page-service.ts",
      );
      assert(service.includes("nextDiscoveryAccessStatus"), "preserve selected");
      assert(
        service.includes('accessStatus: "selected"'),
        "select writes selected",
      );
      const blob = results.map((r) => r.evidence).join(" ");
      assert(!/SYNTH_/.test(blob), "no tokens in evidence");
      assert(!/page-gateau-/.test(blob), "no page ids in evidence");
      record(
        15,
        "No Page IDs, tokens, or connection secrets in client contracts",
        "PASS",
        sanitizeEvidence("sanitized"),
      );
    }

    // ---- Explicit brand image still beats selected Page image ----
    {
      await prisma.businessBrand.update({
        where: { id: brandId },
        data: { imageUrl: "https://cdn.example/explicit-brand.png" },
      });
      const brands = await loadBrandSelectorSnapshots(clientId);
      const brand = brands.find((row) => row.id === brandId);
      assert(
        brand?.displayImageUrl === "https://cdn.example/explicit-brand.png",
        "explicit wins",
      );
      assert(brand?.displayLabel === targetName, "label still Gateau");
      record(
        16,
        "Brand-image fallback uses selected Page only when no explicit brand image",
        "PASS",
        "upload priority",
      );
    }
  } catch (error) {
    record(
      99,
      "Suite harness",
      "FAIL",
      sanitizeEvidence(
        error instanceof Error ? error.message : "unknown error",
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;

    if (clientId) {
      try {
        await prisma.client.delete({ where: { id: clientId } });
      } catch {
        // best-effort cleanup
      }
    }
    await prisma.$disconnect();
  }

  printSummary();
  const failed = results.some((r) => r.status === "FAIL");
  process.exit(failed ? 1 : 0);
}

void main();
