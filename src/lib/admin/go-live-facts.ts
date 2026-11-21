import "server-only";

// Production evidence for the go-live checklist: read-only counts and dates,
// each one failing on its own without hiding the others.
import { getPrisma } from "@/lib/db/prisma";
import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { connectedEngines } from "@/lib/takbot/server";

import type { GoLiveFacts } from "./go-live";

export async function getGoLiveFacts(now = Date.now()): Promise<GoLiveFacts> {
  const prisma = getPrisma();
  const engines = await connectedEngines(now).catch(() => new Set<string>());

  let databaseOk = false;
  let lastAutomaticSyncAt: string | null = null;
  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseOk = true;
    } catch {
      databaseOk = false;
    }
    if (databaseOk) {
      try {
        const last = await prisma.socialAccountSyncState.aggregate({ _max: { lastSuccessAt: true } });
        lastAutomaticSyncAt = last._max.lastSuccessAt?.toISOString() ?? null;
      } catch {
        lastAutomaticSyncAt = null;
      }
    }
  }

  return {
    databaseOk,
    lastAutomaticSyncAt,
    connectedEngines: TAKBOT_ENGINES.filter((engine) => engines.has(engine.key)).length,
    totalEngines: TAKBOT_ENGINES.length,
    anthropicConnected: engines.has("anthropic"),
    now,
  };
}
