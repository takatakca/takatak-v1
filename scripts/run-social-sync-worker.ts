/**
 * Local/ops durable consumer for Facebook Page sync_analytics jobs.
 * Equivalent to GET /api/cron/social-sync-jobs — no user session required.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
  const { runFacebookPageSyncWorkerTick } = await import(
    "../src/lib/social/sync/facebook-page-sync-job"
  );
  const { runFacebookCompetitorWorkerTick } = await import(
    "../src/lib/social/sync/facebook-competitor-sync-job"
  );

  const result = await runFacebookPageSyncWorkerTick({
    limit: Number(process.env.SOCIAL_SYNC_WORKER_LIMIT ?? 5),
    processJobs: true,
  });
  const competitors = await runFacebookCompetitorWorkerTick({
    limit: Number(process.env.SOCIAL_SYNC_WORKER_LIMIT ?? 5),
    processJobs: true,
  });

  console.log(
    JSON.stringify({
      stage: "social_sync_worker",
      outcome: "ok",
      ...result,
      competitors,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "worker failed");
  process.exit(1);
});
