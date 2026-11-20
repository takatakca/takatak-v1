// TAKATAK Food Hub — automatic sync engine.
//
// Every run (dashboard auto-trigger every 2 min, Vercel cron, or "Sync now"):
//   1. Re-opens stores whose timed pause has ended.
//   2. Reads the LIVE status of every mapped store from its platform
//      (Uber Eats store status, DoorDash store_details). Skip and Too Good To Go
//      push their status to us by webhook, so their last pushed state is kept.
//   3. Reads today's in-store sales from every Clover merchant (payments since local
//      midnight, minus refunds, excluding delivery orders Food Hub injected).
//   4. Saves one report the Command Center reads.
// Read-only status checks never change anything on a platform.
import { fetchDoorDashStoreStatus } from './adapters/doordash';
import { fetchUberStoreStatus } from './adapters/uber-eats';
import { nowIso } from './config';
import { logActivity } from './activity';
import { CHANNEL_LABELS } from './config';
import { pollCloverInventory } from './clover-sync';
import { settleInClover } from './clover-settle';
import { dailyReconciliation } from './recon/automation';
import { runDuePublishes } from './menu/schedule';
import { fireDueScheduled } from './scheduling';
import { applyHolidayClosures, reenableExpiredItems, reopenExpiredPauses } from './ops';
import { sendDueReports } from './reports';
import { cloverReadiness, cloverSalesSince, knownCloverMerchants, type CloverSales } from './pos/clover';
import { getRepo } from './repo';
import { startOfLocalDayMs } from './time';
import type { ChannelStore, PlatformState, PlatformStatus } from './types';

export interface StoreSyncRow {
  storeId: string;
  channel: ChannelStore['channel'];
  brandName: string;
  locationCode: string;
  channelStoreId: string;
  polled: boolean;
  ok: boolean;
  state: PlatformState;
  detail?: string;
  error?: string;
  changed: boolean;
}

export interface SyncReport {
  at: string;
  durationMs: number;
  trigger: string;
  businessDayStart: string;
  reopened: number;
  /** Orders accepted/ready/dispatched for longer than FOODHUB_AUTO_COMPLETE_MIN (default 90) and closed automatically. */
  autoCompleted: number;
  /** Timed 86s that ended and were switched back on. */
  itemsReenabled: number;
  /** Skip stores taken offline for a closed holiday. */
  holidayClosures: number;
  /** Scheduled menu publishes that ran. */
  scheduledPublishes: number;
  /** Scheduled report emails sent. */
  reportsSent: number;
  /** Scheduled (advance) orders whose kitchen ticket went out this run. */
  scheduledFired: number;
  /** Clover inventory sync: items switched off / back on everywhere because of Clover, price changes seen. */
  cloverInventory: { turnedOff: number; turnedOn: number; priceChanges: number; errors: string[] };
  /** Once a day: reconciliation cases opened / closed. */
  recon: { opened: number; closed: number } | null;
  stores: StoreSyncRow[];
  clover: Array<CloverSales & { locationCodes: string[] }>;
  cloverConfigured: boolean;
}

const LAST_KEY = 'sync:last';
const LOCK_KEY = '__foodhubSyncRunning';

function minIntervalMs() {
  return Math.max(10, Number(process.env.FOODHUB_SYNC_MIN_INTERVAL_S) || 60) * 1000;
}

export async function lastSyncReport(): Promise<SyncReport | null> {
  return getRepo().getKv<SyncReport>(LAST_KEY);
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function pollStore(store: ChannelStore): Promise<StoreSyncRow> {
  const base = { storeId: store.id, channel: store.channel, brandName: store.brandName, locationCode: store.locationCode, channelStoreId: store.channelStoreId };
  const previous = (store.meta?.platformStatus ?? null) as PlatformStatus | null;
  let fetched: { ok: boolean; state: PlatformState; detail?: string; until?: string | null; error?: string } | null = null;
  if (store.channel === 'uber_eats') fetched = await fetchUberStoreStatus(store.channelStoreId);
  else if (store.channel === 'doordash') fetched = await fetchDoorDashStoreStatus(store.channelStoreId);

  if (!fetched) {
    // Pushed by webhook (Skip offline notification) or set by us; keep the last known state.
    const state: PlatformState = previous?.state ?? (store.online ? 'online' : 'paused');
    return { ...base, polled: false, ok: true, state, detail: previous?.detail, changed: false };
  }

  if (!fetched.ok && fetched.state === 'unknown') {
    // Keep the last good state but record the error so the dashboard can flag it.
    const status: PlatformStatus = { ...(previous ?? { state: 'unknown', source: 'sync' }), checkedAt: nowIso(), source: 'sync', error: fetched.error } as PlatformStatus;
    await getRepo().updateStore(store.id, { meta: { ...store.meta, platformStatus: status } });
    return { ...base, polled: true, ok: false, state: previous?.state ?? 'unknown', detail: previous?.detail, error: fetched.error, changed: false };
  }

  const status: PlatformStatus = { state: fetched.state, detail: fetched.detail, until: fetched.until ?? null, checkedAt: nowIso(), source: 'sync', error: fetched.ok ? undefined : fetched.error };
  const patch: Partial<ChannelStore> = { meta: { ...store.meta, platformStatus: status } };
  // The platform is the source of truth for whether the store takes orders.
  if (fetched.state === 'online' && !store.online) { patch.online = true; patch.pausedUntil = null; patch.lastStatusSource = `${store.channel}:platform`; }
  if ((fetched.state === 'paused' || fetched.state === 'deactivated') && store.online) {
    patch.online = false;
    patch.pausedUntil = fetched.state === 'paused' ? fetched.until ?? null : null;
    patch.lastStatusSource = `${store.channel}:platform`;
  }
  await getRepo().updateStore(store.id, patch);
  const changed = previous?.state !== fetched.state;
  if (changed && previous) {
    await logActivity({ actor: CHANNEL_LABELS[store.channel], source: 'platform', kind: 'store_status', action: `platform_${fetched.state}`, status: fetched.state === 'online' ? 'success' : 'info',
      channel: store.channel, brandName: store.brandName, locationCode: store.locationCode, storeId: store.id,
      summary: `${store.brandName} · ${store.locationCode} on ${CHANNEL_LABELS[store.channel]} is now ${fetched.state}${fetched.detail ? ` (${fetched.detail})` : ''}`, detail: { from: previous.state, to: fetched.state } });
  }
  return { ...base, polled: true, ok: fetched.ok, state: fetched.state, detail: fetched.detail, error: fetched.error, changed };
}

/** Keeps "Orders to handle" clean: in-kitchen/ready orders older than the threshold are closed (logged). */
export async function autoCompleteOldOrders(now = Date.now()): Promise<number> {
  const minutes = Number(process.env.FOODHUB_AUTO_COMPLETE_MIN ?? 90);
  if (!(minutes > 0)) return 0;
  const repo = getRepo();
  const stale = (await repo.listOrders({ statuses: ['accepted', 'ready', 'dispatched'], since: new Date(now - 48 * 3600_000).toISOString(), limit: 1000 }))
    .filter((o) => now - new Date(o.createdAt).getTime() > minutes * 60_000);
  for (const o of stale) {
    const done = await repo.updateOrder(o.id, { status: 'completed', timeline: { ...(o.timeline ?? {}), completedAt: o.timeline?.completedAt ?? new Date(now).toISOString() } });
    await repo.addEvent(o.id, 'auto_completed', { afterMinutes: minutes });
    await settleInClover(done); // closes the Clover order as paid
  }
  return stale.length;
}

export async function runSync(opts: { trigger?: string; force?: boolean } = {}): Promise<{ ran: boolean; reason?: string; report: SyncReport | null }> {
  const repo = getRepo();
  const last = await lastSyncReport();
  if (!opts.force && last && Date.now() - new Date(last.at).getTime() < minIntervalMs()) {
    return { ran: false, reason: `Last sync ${Math.round((Date.now() - new Date(last.at).getTime()) / 1000)} s ago`, report: last };
  }
  const g = globalThis as unknown as Record<string, boolean>;
  if (g[LOCK_KEY]) return { ran: false, reason: 'A sync is already running', report: last };
  g[LOCK_KEY] = true;
  const started = Date.now();
  try {
    const reopened = await reopenExpiredPauses().catch(() => []);
    const autoCompleted = await autoCompleteOldOrders().catch(() => 0);
    const itemsReenabled = await reenableExpiredItems().catch(() => 0);
    const holidayClosures = await applyHolidayClosures().catch(() => 0);
    const scheduledPublishes = await runDuePublishes().catch(() => 0);
    const reportsSent = await sendDueReports().catch(() => 0);
    const scheduledFired = await fireDueScheduled().catch(() => 0);
    const inv = await pollCloverInventory().catch((e) => ({ turnedOff: 0, turnedOn: 0, priceChanges: 0, errors: [String(e?.message ?? e)] }));
    const recon = await dailyReconciliation().catch(() => null);
    const stores = await repo.listStores();
    const storeRows = await pool(stores, 4, (s) => pollStore(s).catch((e) => ({
      storeId: s.id, channel: s.channel, brandName: s.brandName, locationCode: s.locationCode, channelStoreId: s.channelStoreId,
      polled: true, ok: false, state: 'unknown' as PlatformState, error: e instanceof Error ? e.message : String(e), changed: false,
    })));

    const dayStart = startOfLocalDayMs();
    const todays = await repo.listOrders({ since: new Date(dayStart).toISOString(), limit: 2000 });
    const injected = new Set(todays.map((o) => o.posOrderId).filter(Boolean) as string[]);
    const merchants = knownCloverMerchants(stores.map((s) => s.cloverMerchantId));
    const clover = await pool(merchants, 3, async (mid) => {
      const sales = await cloverSalesSince(mid, dayStart, injected);
      const locationCodes = [...new Set(stores.filter((s) => (s.cloverMerchantId || process.env.CLOVER_MERCHANT_ID) === mid).map((s) => s.locationCode))];
      return { ...sales, locationCodes };
    });

    const report: SyncReport = {
      at: nowIso(),
      durationMs: Date.now() - started,
      trigger: opts.trigger || 'manual',
      businessDayStart: new Date(dayStart).toISOString(),
      reopened: reopened.length,
      autoCompleted,
      itemsReenabled,
      holidayClosures,
      scheduledPublishes,
      reportsSent,
      scheduledFired,
      cloverInventory: { turnedOff: inv.turnedOff, turnedOn: inv.turnedOn, priceChanges: inv.priceChanges, errors: inv.errors },
      recon,
      stores: storeRows,
      clover,
      cloverConfigured: cloverReadiness().configured,
    };
    await repo.setKv(LAST_KEY, report);
    return { ran: true, report };
  } finally {
    g[LOCK_KEY] = false;
  }
}
