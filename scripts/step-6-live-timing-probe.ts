/**
 * Live timing probe for brand-selector + Facebook sync durability paths.
 * Never prints Page IDs, tokens, or raw Meta payloads.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

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

async function main() {
  const prisma = new PrismaClient();
  const {
    loadBrandSelectorSnapshots,
    resetBrandSelectorCacheForTests,
  } = await import("../src/lib/security/brand-context");

  const client = await prisma.client.findFirst({
    where: { status: "active" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!client) {
    console.log("No active client — live probe skipped");
    await prisma.$disconnect();
    return;
  }

  console.log("=== Live Step 6 / Brand Selector Timing Probe ===");
  console.log(`workspace=${client.name ? "[present]" : "unnamed"}`);

  resetBrandSelectorCacheForTests();
  const coldStart = Date.now();
  const cold = await loadBrandSelectorSnapshots(client.id, {
    bypassCache: true,
  });
  const coldMs = Date.now() - coldStart;

  const warmStart = Date.now();
  const warm = await loadBrandSelectorSnapshots(client.id);
  const warmMs = Date.now() - warmStart;

  const warm2Start = Date.now();
  await Promise.all([
    loadBrandSelectorSnapshots(client.id),
    loadBrandSelectorSnapshots(client.id),
    loadBrandSelectorSnapshots(client.id),
    loadBrandSelectorSnapshots(client.id),
  ]);
  const warm4Ms = Date.now() - warm2Start;

  const plan = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>`
    EXPLAIN (FORMAT TEXT)
    SELECT b.id
    FROM business_brands b
    LEFT JOIN social_accounts s
      ON s."clientId" = b."clientId"
      AND s."businessBrandId" = b.id
      AND s.status = 'connected'
      AND (s."accessStatus" = 'selected' OR s.platform <> 'facebook')
    WHERE b."clientId" = ${client.id}::uuid
      AND b.status <> 'archived'
  `;

  console.log(
    JSON.stringify({
      stage: "brand_selector",
      brandCount: cold.length,
      coldMs,
      warmCacheMs: warmMs,
      fourCoalescedMs: warm4Ms,
      queryPlanHead: plan.slice(0, 6).map((row) => Object.values(row)[0]),
    }),
  );

  const syncing = await prisma.socialAccountSyncState.count({
    where: { clientId: client.id, status: "syncing" },
  });
  const ready = await prisma.socialAccountSyncState.count({
    where: { clientId: client.id, status: "ready" },
  });
  const failed = await prisma.socialAccountSyncState.count({
    where: { clientId: client.id, status: "failed" },
  });
  const empty = await prisma.socialAccountSyncState.count({
    where: { clientId: client.id, status: "empty" },
  });

  console.log(
    JSON.stringify({
      stage: "sync_state_summary",
      syncing,
      ready,
      failed,
      empty,
      note: "Zeros on UI are invalid unless status is ready/degraded with confirmed metrics",
    }),
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "probe failed");
  process.exit(1);
});
