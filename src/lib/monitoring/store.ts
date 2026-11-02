import "server-only";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { monitoringDomainWhere, record, snapshotSchema, type MonitoringSnapshot } from "./policy";

export function monitoringDb() {
  const db = getPrisma();
  if (!db) throw new ServiceError("unavailable", "Monitoring is temporarily unavailable.");
  return db;
}

/** All reads and updates carry an explicit workspace filter. No global fallback. */
export async function updateMonitoringMetadata(clientId: string, domainId: string, change: (metadata: Record<string, unknown>) => Record<string, unknown>) {
  const db = monitoringDb();
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await db.domainAsset.findFirst({ where: monitoringDomainWhere(clientId, domainId), select: { metadata: true, updatedAt: true } });
    if (!row) throw new ServiceError("not_found", "Website not found in this workspace.");
    const metadata = change(record(row.metadata));
    const result = await db.domainAsset.updateMany({
      where: { ...monitoringDomainWhere(clientId, domainId), updatedAt: row.updatedAt },
      data: { metadata: metadata as Prisma.InputJsonObject, updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) },
    });
    if (result.count === 1) return;
  }
  throw new ServiceError("conflict", "Website changed. Please try again.");
}

export type MonitoringRow = {
  id: string; hostname: string; snapshot: MonitoringSnapshot | null;
  billing: { status: string; paidUntil: number | null; cancelAtPeriodEnd: boolean };
};

export async function getMonitoringRows(clientId: string): Promise<MonitoringRow[]> {
  const rows = await monitoringDb().domainAsset.findMany({
    where: monitoringDomainWhere(clientId), select: { id: true, domainName: true, metadata: true }, orderBy: { domainName: "asc" },
  });
  return rows.map(row => {
    const meta = record(row.metadata), billing = record(meta.monitoringBilling);
    const parsed = snapshotSchema.safeParse(meta.monitoringSnapshot);
    const snapshot = parsed.success && parsed.data.domainAssetId === row.id && parsed.data.hostname === row.domainName ? parsed.data : null;
    return { id: row.id, hostname: row.domainName, snapshot, billing: {
      status: typeof billing.status === "string" ? billing.status : "not_subscribed",
      paidUntil: typeof billing.paidUntil === "number" ? billing.paidUntil : null,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd === true,
    } };
  });
}

export async function getMonitoringDashboard(clientId: string) {
  try { return { rows: await getMonitoringRows(clientId), now: Date.now(), unavailable: false }; }
  catch { return { rows: [] as MonitoringRow[], now: Date.now(), unavailable: true }; }
}
