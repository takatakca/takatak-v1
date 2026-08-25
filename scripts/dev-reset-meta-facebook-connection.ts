/**
 * Development-only reset: Meta/Facebook social-connection data for one brand.
 *
 * Deletes (scoped to --clientId + --brandId, provider=meta / Meta platforms only):
 *   SocialOAuthState, SocialCredential, SocialBrandAccountAssignment,
 *   SocialAdAnalyticsDaily, SocialAdAccount (meta_ads on Meta connections),
 *   Approval + SocialPost (facebook/instagram/threads for this brand),
 *   SocialAnalyticsDaily (same platforms), SocialAccount (Meta-linked),
 *   SocialProviderConnection (provider=meta)
 *
 * Preserves: Client, BusinessBrand, Profile/membership, ClientSubscription,
 *   other providers (google, linkedin, …), unrelated campaigns/posts.
 *
 * Usage:
 *   NODE_ENV=development npx tsx scripts/dev-reset-meta-facebook-connection.ts \
 *     --clientId=<uuid> --brandId=<uuid> --confirm="<Exact Brand Name>"
 *
 * Optional dry run:
 *   ... --dry-run
 *
 * Never prints tokens, Page IDs, credentials, OAuth values, or connection IDs.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient, type SocialPlatform } from "@prisma/client";

const META_SOCIAL_PLATFORMS: SocialPlatform[] = [
  "facebook",
  "instagram",
  "threads",
];

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

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq > 0) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function assertDevOnly() {
  const nodeEnv = String(process.env.NODE_ENV ?? "");
  const vercelEnv = String(process.env.VERCEL_ENV ?? "");

  if (nodeEnv === "production" || vercelEnv === "production") {
    throw new Error(
      "Refusing Meta/Facebook reset: NODE_ENV or VERCEL_ENV is production.",
    );
  }

  if (nodeEnv !== "development" && process.env.ALLOW_DEV_META_RESET !== "1") {
    throw new Error(
      "Refusing Meta/Facebook reset: set NODE_ENV=development or ALLOW_DEV_META_RESET=1.",
    );
  }
}

type DeletionCounts = {
  oauthStates: number;
  credentials: number;
  brandAssignments: number;
  adAnalyticsDaily: number;
  adAccounts: number;
  approvals: number;
  socialPosts: number;
  analyticsDaily: number;
  socialAccounts: number;
  providerConnections: number;
};

async function main() {
  assertDevOnly();

  if (!process.env.DATABASE_URL) {
    console.error("[dev-reset-meta] DATABASE_URL is not set. Nothing changed.");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const clientId = String(args.clientId ?? "");
  const brandId = String(args.brandId ?? "");
  const confirm = String(args.confirm ?? "");
  const dryRun = args.dryRun === true;

  if (!isUuid(clientId) || !isUuid(brandId) || !confirm.trim()) {
    console.error(
      [
        "[dev-reset-meta] Usage:",
        '  NODE_ENV=development npx tsx scripts/dev-reset-meta-facebook-connection.ts \\',
        '    --clientId=<workspace-uuid> --brandId=<brand-uuid> --confirm="<Exact Brand Name>"',
        "  Optional: --dry-run",
        "",
        "Confirmation must match the BusinessBrand.name exactly (case-sensitive).",
      ].join("\n"),
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const brand = await prisma.businessBrand.findFirst({
      where: {
        id: brandId,
        clientId,
        status: { not: "archived" },
      },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { name: true, status: true } },
      },
    });

    if (!brand) {
      console.error(
        "[dev-reset-meta] Workspace/brand not found (or archived). Nothing changed.",
      );
      process.exit(1);
    }

    if (confirm !== brand.name) {
      console.error(
        "[dev-reset-meta] Confirmation did not match the brand name. Nothing changed.",
      );
      console.error(
        `[dev-reset-meta] Expected exact --confirm matching BusinessBrand.name for this workspace (${brand.client.name}).`,
      );
      process.exit(1);
    }

    const metaConnections = await prisma.socialProviderConnection.findMany({
      where: {
        clientId,
        businessBrandId: brandId,
        provider: "meta",
      },
      select: { id: true },
    });
    const connectionIds = metaConnections.map((row) => row.id);

    const metaAccounts = await prisma.socialAccount.findMany({
      where: {
        clientId,
        OR: [
          ...(connectionIds.length > 0
            ? [{ providerConnectionId: { in: connectionIds } }]
            : []),
          {
            businessBrandId: brandId,
            platform: { in: META_SOCIAL_PLATFORMS },
          },
        ],
      },
      select: { id: true },
    });
    const accountIds = [...new Set(metaAccounts.map((row) => row.id))];

    const metaAdAccounts = await prisma.socialAdAccount.findMany({
      where: {
        clientId,
        businessBrandId: brandId,
        OR: [
          ...(connectionIds.length > 0
            ? [{ providerConnectionId: { in: connectionIds } }]
            : []),
          { platform: "meta_ads" },
        ],
      },
      select: { id: true },
    });
    const adAccountIds = metaAdAccounts.map((row) => row.id);

    const metaPosts = await prisma.socialPost.findMany({
      where: {
        clientId,
        OR: [
          ...(accountIds.length > 0
            ? [{ socialAccountId: { in: accountIds } }]
            : []),
          {
            businessBrandId: brandId,
            platform: { in: META_SOCIAL_PLATFORMS },
          },
        ],
      },
      select: { id: true },
    });
    const postIds = metaPosts.map((row) => row.id);

    const preview: DeletionCounts = {
      oauthStates: await prisma.socialOAuthState.count({
        where: {
          clientId,
          businessBrandId: brandId,
          provider: "meta",
        },
      }),
      credentials:
        connectionIds.length === 0
          ? 0
          : await prisma.socialCredential.count({
              where: {
                clientId,
                connectionId: { in: connectionIds },
              },
            }),
      brandAssignments:
        accountIds.length === 0
          ? 0
          : await prisma.socialBrandAccountAssignment.count({
              where: {
                clientId,
                businessBrandId: brandId,
                socialAccountId: { in: accountIds },
              },
            }),
      adAnalyticsDaily:
        adAccountIds.length === 0
          ? 0
          : await prisma.socialAdAnalyticsDaily.count({
              where: {
                clientId,
                businessBrandId: brandId,
                adAccountId: { in: adAccountIds },
              },
            }),
      adAccounts: adAccountIds.length,
      approvals:
        postIds.length === 0
          ? 0
          : await prisma.approval.count({
              where: {
                clientId,
                socialPostId: { in: postIds },
              },
            }),
      socialPosts: postIds.length,
      analyticsDaily: await prisma.socialAnalyticsDaily.count({
        where: {
          clientId,
          OR: [
            ...(accountIds.length > 0
              ? [{ socialAccountId: { in: accountIds } }]
              : []),
            {
              businessBrandId: brandId,
              platform: { in: META_SOCIAL_PLATFORMS },
            },
          ],
        },
      }),
      socialAccounts: accountIds.length,
      providerConnections: connectionIds.length,
    };

    console.log("[dev-reset-meta] Target workspace/brand confirmed.");
    console.log(
      `[dev-reset-meta] Mode: ${dryRun ? "dry-run (no writes)" : "delete"}`,
    );
    console.log("[dev-reset-meta] Planned deletion counts (sanitized):");
    console.log(`  oauthStates: ${preview.oauthStates}`);
    console.log(`  credentials: ${preview.credentials}`);
    console.log(`  brandAssignments: ${preview.brandAssignments}`);
    console.log(`  adAnalyticsDaily: ${preview.adAnalyticsDaily}`);
    console.log(`  adAccounts: ${preview.adAccounts}`);
    console.log(`  approvals: ${preview.approvals}`);
    console.log(`  socialPosts: ${preview.socialPosts}`);
    console.log(`  analyticsDaily: ${preview.analyticsDaily}`);
    console.log(`  socialAccounts: ${preview.socialAccounts}`);
    console.log(`  providerConnections: ${preview.providerConnections}`);
    console.log(
      "[dev-reset-meta] Preserved: workspace, brand, memberships, subscriptions, non-Meta providers.",
    );

    if (dryRun) {
      console.log("[dev-reset-meta] Dry run complete. Nothing changed.");
      printMetaAuthNote();
      return;
    }

    const counts = await prisma.$transaction(async (tx) => {
      const deleted: DeletionCounts = {
        oauthStates: 0,
        credentials: 0,
        brandAssignments: 0,
        adAnalyticsDaily: 0,
        adAccounts: 0,
        approvals: 0,
        socialPosts: 0,
        analyticsDaily: 0,
        socialAccounts: 0,
        providerConnections: 0,
      };

      // 1) OAuth attempts for this brand + Meta (including orphaned states).
      deleted.oauthStates = (
        await tx.socialOAuthState.deleteMany({
          where: {
            clientId,
            businessBrandId: brandId,
            provider: "meta",
          },
        })
      ).count;

      // 2) Approvals for Meta-platform / Meta-account posts.
      if (postIds.length > 0) {
        deleted.approvals = (
          await tx.approval.deleteMany({
            where: {
              clientId,
              socialPostId: { in: postIds },
            },
          })
        ).count;
      }

      // 3) Social posts for Meta platforms / accounts on this brand.
      if (postIds.length > 0) {
        deleted.socialPosts = (
          await tx.socialPost.deleteMany({
            where: { id: { in: postIds }, clientId },
          })
        ).count;
      }

      // 4) Organic analytics tied to Meta accounts/platforms.
      deleted.analyticsDaily = (
        await tx.socialAnalyticsDaily.deleteMany({
          where: {
            clientId,
            OR: [
              ...(accountIds.length > 0
                ? [{ socialAccountId: { in: accountIds } }]
                : []),
              {
                businessBrandId: brandId,
                platform: { in: META_SOCIAL_PLATFORMS },
              },
            ],
          },
        })
      ).count;

      // 5) Ad analytics then Meta ad accounts for this brand.
      if (adAccountIds.length > 0) {
        deleted.adAnalyticsDaily = (
          await tx.socialAdAnalyticsDaily.deleteMany({
            where: {
              clientId,
              businessBrandId: brandId,
              adAccountId: { in: adAccountIds },
            },
          })
        ).count;
      }

      deleted.adAccounts = (
        await tx.socialAdAccount.deleteMany({
          where: {
            clientId,
            businessBrandId: brandId,
            OR: [
              ...(connectionIds.length > 0
                ? [{ providerConnectionId: { in: connectionIds } }]
                : []),
              { platform: "meta_ads" },
            ],
          },
        })
      ).count;

      // 6) Brand ↔ Page assignments for Meta accounts.
      if (accountIds.length > 0) {
        deleted.brandAssignments = (
          await tx.socialBrandAccountAssignment.deleteMany({
            where: {
              clientId,
              businessBrandId: brandId,
              socialAccountId: { in: accountIds },
            },
          })
        ).count;
      }

      // 7) Encrypted credentials (also cascade on connection delete; explicit for counts).
      if (connectionIds.length > 0) {
        deleted.credentials = (
          await tx.socialCredential.deleteMany({
            where: {
              clientId,
              connectionId: { in: connectionIds },
            },
          })
        ).count;
      }

      // 8) Discovered / selected Meta social accounts (Pages + IG/Threads shells).
      if (accountIds.length > 0) {
        deleted.socialAccounts = (
          await tx.socialAccount.deleteMany({
            where: { id: { in: accountIds }, clientId },
          })
        ).count;
      }

      // 9) Meta provider connection shells for this brand.
      deleted.providerConnections = (
        await tx.socialProviderConnection.deleteMany({
          where: {
            clientId,
            businessBrandId: brandId,
            provider: "meta",
          },
        })
      ).count;

      return deleted;
    });

    console.log("[dev-reset-meta] Deletion complete. Sanitized counts:");
    console.log(`  oauthStates: ${counts.oauthStates}`);
    console.log(`  credentials: ${counts.credentials}`);
    console.log(`  brandAssignments: ${counts.brandAssignments}`);
    console.log(`  adAnalyticsDaily: ${counts.adAnalyticsDaily}`);
    console.log(`  adAccounts: ${counts.adAccounts}`);
    console.log(`  approvals: ${counts.approvals}`);
    console.log(`  socialPosts: ${counts.socialPosts}`);
    console.log(`  analyticsDaily: ${counts.analyticsDaily}`);
    console.log(`  socialAccounts: ${counts.socialAccounts}`);
    console.log(`  providerConnections: ${counts.providerConnections}`);

    printMetaAuthNote();
  } finally {
    await prisma.$disconnect();
  }
}

function printMetaAuthNote() {
  console.log("");
  console.log("[dev-reset-meta] Meta app authorization note:");
  console.log(
    "  This script only clears Takatak DB state for the brand. It does NOT",
  );
  console.log(
    "  revoke the Facebook/Meta app grant on Meta’s side. For a genuinely",
  );
  console.log(
    "  fresh consent/OAuth screen, also remove the app in Facebook:",
  );
  console.log(
    "  Settings → Apps and Websites (or Business Integrations) → remove Takatak/Meta app,",
  );
  console.log(
    "  or use Facebook Login for Business / developer test-user tooling to reset grants.",
  );
}

void main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown reset failure.";
  // Never dump Prisma payloads (may include ciphertext / external ids).
  console.error(`[dev-reset-meta] ${message}`);
  process.exit(1);
});
