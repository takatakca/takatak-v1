import { z } from "zod";
import { readBoundedText } from "@/lib/http/read-bounded-text";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { hostname, monitoringEntitled, record, snapshotSchema, uuid, verifySnapshotSignature } from "@/lib/monitoring/policy";
import { monitoringDb, updateMonitoringMetadata } from "@/lib/monitoring/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const authorizationSchema = z.object({ kind: z.literal("authorization"), domainAssetId: uuid, hostname }).strict();

export async function POST(request: Request) {
  if (!process.env.MONITORING_SYNC_KEYS) return jsonResponse({ ok: false }, 503);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return jsonResponse({ ok: false }, 415);
  const raw = await readBoundedText(request, 8192);
  if (raw === null) return jsonResponse({ ok: false }, 413);
  let input: Record<string, unknown>, grants: Record<string, unknown>;
  try { input = record(JSON.parse(raw)); grants = record(JSON.parse(process.env.MONITORING_SYNC_KEYS)); }
  catch { return jsonResponse({ ok: false }, 400); }
  const id = uuid.safeParse(input.domainAssetId);
  const secret = id.success ? grants[id.data] : null;
  if (typeof secret !== "string" || !verifySnapshotSignature(raw, request.headers.get("x-monitor-timestamp"), request.headers.get("x-monitor-signature"), secret)) {
    return jsonResponse({ ok: false }, 401);
  }
  const parsed = input.kind === "authorization" ? authorizationSchema.safeParse(input) : snapshotSchema.safeParse(input);
  if (!parsed.success) return jsonResponse({ ok: false }, 400);
  try {
    // The operator's per-domain key selects exactly one stored domain; clients cannot submit a workspace id.
    const domain = await monitoringDb().domainAsset.findUnique({ where: { id: id.data! }, select: { id: true, clientId: true, domainName: true, metadata: true, client: { select: { status: true } } } });
    if (!domain || domain.domainName !== parsed.data.hostname) return jsonResponse({ ok: false }, 403);
    const enabled = !["paused", "archived"].includes(domain.client.status) && monitoringEntitled(record(domain.metadata).monitoringBilling);
    if (input.kind === "authorization") return jsonResponse({ ok: true, enabled }, 200);
    if (!enabled) return jsonResponse({ ok: false, enabled: false }, 403);
    const snapshot = snapshotSchema.parse(input);
    if (Math.abs(Date.now() / 1000 - snapshot.observedAt) > 1800) return jsonResponse({ ok: false }, 400);
    await updateMonitoringMetadata(domain.clientId, domain.id, metadata => {
      // Re-check entitlement inside the optimistic update to handle concurrent cancellations.
      if (!monitoringEntitled(metadata.monitoringBilling)) throw new Error("monitoring_inactive");
      const previous = snapshotSchema.safeParse(metadata.monitoringSnapshot);
      if (previous.success && previous.data.observedAt >= snapshot.observedAt) return metadata;
      return { ...metadata, monitoringSnapshot: snapshot };
    });
    return jsonResponse({ ok: true, accepted: true }, 200);
  } catch (error) {
    return handleApiError("monitoring-ingest", error, "Monitoring update could not be applied.");
  }
}
