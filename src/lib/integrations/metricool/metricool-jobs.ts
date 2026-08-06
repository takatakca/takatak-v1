// Phase 6 — Metricool job PLANNING (no execution, ever, in this phase).
// Returns planned payloads; optionally persists a planned DB Job record.
// Jobs are never run, never marked completed, and never touch Metricool.
import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import type { MetricoolPlannedSyncJob } from "./types";

async function plan(
  type: MetricoolPlannedSyncJob["type"],
  description: string,
  persist: boolean,
): Promise<MetricoolPlannedSyncJob> {
  const base: MetricoolPlannedSyncJob = {
    type,
    provider: "metricool",
    status: "planned",
    description,
    persisted: false,
  };
  if (!persist) return base;
  const prisma = getPrisma();
  if (!prisma) return base; // DB not configured — plan stays in-memory only
  try {
    const job = await prisma.job.create({
      data: {
        type,
        provider: "metricool",
        status: "planned",
        metadata: { plannedBy: "phase6_foundation", description },
      },
      select: { id: true },
    });
    return { ...base, persisted: true, jobId: job.id };
  } catch (error) {
    console.error(
      "[metricool-jobs] Could not persist planned job:",
      error instanceof Error ? error.message : "unknown error",
    );
    return base;
  }
}

export function createMetricoolSyncAnalyticsPlan(options?: { persist?: boolean }) {
  return plan(
    "sync_analytics",
    "Planned: pull daily analytics per connected account from Metricool. Activates after a verified connection.",
    options?.persist ?? false,
  );
}

export function createMetricoolSendApprovedPostsPlan(options?: { persist?: boolean }) {
  return plan(
    "send_to_metricool",
    "Planned: push approved, scheduled posts to Metricool. Activates after a verified connection.",
    options?.persist ?? false,
  );
}
