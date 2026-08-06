// Phase 8 — Upmind job PLANNING only. Nothing runs, provisions, registers,
// or syncs. Jobs are never marked completed here.
import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import type { UpmindPlannedSyncJob } from "./types";

async function plan(
  type: UpmindPlannedSyncJob["type"],
  planKind: UpmindPlannedSyncJob["planKind"],
  description: string,
  persist: boolean,
): Promise<UpmindPlannedSyncJob> {
  const base: UpmindPlannedSyncJob = { type, planKind, provider: "upmind", status: "planned", description, persisted: false };
  if (!persist) return base;
  const prisma = getPrisma();
  if (!prisma) return base;
  try {
    const job = await prisma.job.create({
      data: {
        type,
        provider: "upmind",
        status: "planned",
        metadata: { plannedBy: "phase8_foundation", planKind, description },
      },
      select: { id: true },
    });
    return { ...base, persisted: true, jobId: job.id };
  } catch (error) {
    console.error("[upmind-jobs] Could not persist planned job:", error instanceof Error ? error.message : "unknown");
    return base;
  }
}

export const createUpmindProductSyncPlan = (o?: { persist?: boolean }) =>
  plan("retry_integration_task", "product_sync", "Planned: sync Upmind product catalogue. Activates after a verified connection.", o?.persist ?? false);

export const createUpmindClientServiceSyncPlan = (o?: { persist?: boolean }) =>
  plan("retry_integration_task", "client_service_sync", "Planned: sync client services from Upmind. Activates after a verified connection.", o?.persist ?? false);

export const createUpmindInvoiceSyncPlan = (o?: { persist?: boolean }) =>
  plan("retry_integration_task", "invoice_sync", "Planned: sync invoices from Upmind. Activates after a verified connection.", o?.persist ?? false);

export const createUpmindProvisioningPlan = (o?: { persist?: boolean }) =>
  plan("provision_hosting", "provisioning_sync", "Planned: track Upmind hosting provisioning through to live. Activates after a verified connection.", o?.persist ?? false);

export const createUpmindDomainStatusSyncPlan = (o?: { persist?: boolean }) =>
  plan("sync_domain_status", "domain_status_sync", "Planned: sync domain status/expiry from Upmind. Activates after a verified connection.", o?.persist ?? false);
