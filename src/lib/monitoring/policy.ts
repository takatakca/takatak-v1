import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const MONITORING_PRICE_CENTS = 500;
export const MONITORING_BILLING_DOMAIN = "website_monitoring";
export const MONITORING_PATH = "/dashboard/web-hosting/monitoring";
export const uuid = z.string().uuid();
export const hostname = z.string().max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const snapshotSchema = z.object({
  domainAssetId: uuid,
  hostname,
  observedAt: z.number().int().positive(),
  intervalSeconds: z.number().int().min(60).max(3600),
  stable: z.enum(["unknown", "up", "down"]),
  ok: z.boolean(),
  status: z.number().int().min(100).max(599).nullable(),
  latencyMs: z.number().int().min(0).max(600000),
  reason: z.enum(["http", "blocked_address", "network_or_tls"]),
  months: z.array(z.object({
    month, checks: z.number().int().min(0).max(1000000),
    successes: z.number().int().min(0).max(1000000),
    meanMs: z.number().min(0).max(600000),
  }).strict().refine(row => row.successes <= row.checks)).max(2),
}).strict().refine(value => new Set(value.months.map(row => row.month)).size === value.months.length);
export type MonitoringSnapshot = z.infer<typeof snapshotSchema>;

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function verifySnapshotSignature(raw: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()): boolean {
  if (!/^\d{10}$/.test(timestamp ?? "") || !/^[0-9a-f]{64}$/.test(signature ?? "") || !/^[0-9a-f]{64}$/.test(secret)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", Buffer.from(secret, "hex")).update(`${timestamp}.${raw}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature!, "hex"));
}

export function snapshotState(value: MonitoringSnapshot | null, now = Date.now()) {
  if (!value) return "awaiting_check" as const;
  if (now / 1000 - value.observedAt > value.intervalSeconds * 3 || value.observedAt * 1000 > now + 60000) return "stale" as const;
  return value.stable;
}

export function monitoringEntitled(billing: unknown, now = Date.now()): boolean {
  const value = record(billing);
  return value.status === "active" && typeof value.paidUntil === "number" && value.paidUntil * 1000 > now;
}

export function monitoringDomainWhere(clientId: string, domainAssetId?: string) {
  return { clientId: uuid.parse(clientId), ...(domainAssetId ? { id: uuid.parse(domainAssetId) } : {}) };
}

export function reportCsv(rows: { hostname: string; snapshot: MonitoringSnapshot | null }[], selectedMonth: string): string {
  month.parse(selectedMonth);
  const csv = ["month_utc,hostname,observed_checks,successful_checks,sample_success_percent,mean_check_ms"];
  for (const row of rows) {
    // Hostnames are schema validated at ingestion, and validated again for CSV safety.
    if (!hostname.safeParse(row.hostname).success) continue;
    const stats = row.snapshot?.months.find(item => item.month === selectedMonth);
    csv.push([selectedMonth, row.hostname, stats?.checks ?? 0, stats?.successes ?? 0,
      stats?.checks ? (100 * stats.successes / stats.checks).toFixed(3) : "", stats?.meanMs ?? ""].join(","));
  }
  return csv.join("\r\n") + "\r\n";
}
