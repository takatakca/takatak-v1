// TAKATAK Command Center — everything on one screen.
// Pure aggregation over what Food Hub already stores (orders, stores, jobs) plus the
// last sync report (platform store states + Clover in-store sales). No platform calls here,
// so the screen can refresh every few seconds without touching any API limits.
import rawLocations from './seed/locations.json';
import rawDoorDashStores from './seed/platform-stores-doordash.json';
import { ADAPTERS, CHANNEL_KEYS } from './adapters';
import { CHANNEL_LABELS, liveConnectorsGloballyEnabled, round2 } from './config';
import { getCatalog } from './catalog';
import { cloverReadiness } from './pos/clover';
import { allowedActions } from './pipeline';
import { listCloverPriceChanges, VERIFY_KEY } from './clover-sync';
import { listCases, RECOVERABLE } from './recon/engine';
import { isWaitingScheduled } from './scheduling';
import { getPrepSettings, DEFAULT_PREP } from './prep';
import { getRepo } from './repo';
import { lastSyncReport, type SyncReport } from './sync';
import { foodhubTimeZone, localDateLabel, localHour, startOfLocalDayMs } from './time';
import type { ChannelKey, ChannelStore, PlatformState, PlatformStatus, StoredOrder } from './types';

export const REQUIRED_CHANNELS: ChannelKey[] = ['uber_eats', 'doordash', 'skip'];

/** Minutes a platform gives you to answer a new order before it is cancelled / re-routed. */
export const ORDER_DEADLINE_MIN: Partial<Record<ChannelKey, number>> = { uber_eats: 11.5, skip: 5 };

export type CellState = PlatformState | 'not_synced' | 'missing';

export interface MatrixCell {
  state: CellState;
  source: 'live' | 'screenshot' | 'none';
  stores: number;
  storeIds: string[];
  detail?: string;
  until?: string | null;
  checkedAt?: string;
}

export interface MatrixRow {
  brandName: string;
  locationCode: string;
  cells: Record<ChannelKey, MatrixCell>;
  issues: number;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail?: string;
  href?: string;
  at?: string;
  orderId?: string;
}

type SeedStore = { brand_name: string; store_name: string; location_code: string; activation_status: string; open_status: string };

const LOCATIONS = rawLocations as Array<{ code: string; name: string; address_line_1: string }>;
const SEED_DD = rawDoorDashStores as SeedStore[];

const STATE_RANK: Record<CellState, number> = { online: 6, closed: 5, paused: 4, not_synced: 3, unknown: 2, deactivated: 1, missing: 0 };
const OPEN: StoredOrder['status'][] = ['new', 'accepted', 'ready', 'dispatched'];
// 'failed' = handed back to the platform (Skip tablet) — still a sale, made from the tablet.
const COUNTED = (o: StoredOrder) => o.status !== 'cancelled';

function storeState(s: ChannelStore): { state: CellState; detail?: string; until?: string | null; checkedAt?: string } {
  const ps = s.meta?.platformStatus as PlatformStatus | undefined;
  if (ps?.state) return { state: ps.state, detail: ps.detail, until: ps.until ?? s.pausedUntil ?? null, checkedAt: ps.checkedAt };
  // Skip / TGTG are push-only and Uber/DoorDash before the first sync: use what we know.
  if (!s.online) return { state: 'paused', until: s.pausedUntil ?? null, detail: 'Paused from TAKATAK' };
  return { state: s.channel === 'uber_eats' || s.channel === 'doordash' ? 'not_synced' : 'online' };
}

function seedState(rows: SeedStore[]): CellState {
  const states = rows.map<CellState>((r) => (r.activation_status === 'deactivated' ? 'deactivated' : r.open_status === 'closed' ? 'closed' : r.open_status === 'open' ? 'online' : 'unknown'));
  return states.sort((a, b) => STATE_RANK[b] - STATE_RANK[a])[0] ?? 'missing';
}

export function buildMatrix(stores: ChannelStore[], locOrder: string[] = LOCATIONS.map((l) => l.code), scope?: string[]): MatrixRow[] {
  const keys = new Map<string, { brandName: string; locationCode: string }>();
  const add = (brandName: string, locationCode: string) => keys.set(`${brandName}|${locationCode}`, { brandName, locationCode });
  for (const s of SEED_DD) if (!scope?.length || scope.includes(s.location_code)) add(s.brand_name, s.location_code);
  for (const s of stores) if (s.channel !== 'tgtg' && (!scope?.length || scope.includes(s.locationCode))) add(s.brandName, s.locationCode);

  const rows: MatrixRow[] = [];
  for (const { brandName, locationCode } of keys.values()) {
    const cells = {} as Record<ChannelKey, MatrixCell>;
    let issues = 0;
    for (const ch of CHANNEL_KEYS) {
      const mapped = stores.filter((s) => s.channel === ch && s.brandName === brandName && s.locationCode === locationCode);
      if (mapped.length) {
        const best = mapped.map((s) => ({ s, ...storeState(s) })).sort((a, b) => STATE_RANK[b.state] - STATE_RANK[a.state])[0];
        cells[ch] = { state: best.state, source: 'live', stores: mapped.length, storeIds: mapped.map((s) => s.id), detail: best.detail, until: best.until, checkedAt: best.checkedAt };
      } else if (ch === 'doordash') {
        const seed = SEED_DD.filter((s) => s.brand_name === brandName && s.location_code === locationCode);
        cells[ch] = seed.length
          ? { state: seedState(seed), source: 'screenshot', stores: seed.length, storeIds: [], detail: seed.map((s) => s.store_name).join(' · ') }
          : { state: 'missing', source: 'none', stores: 0, storeIds: [] };
      } else {
        cells[ch] = { state: 'missing', source: 'none', stores: 0, storeIds: [] };
      }
      if (REQUIRED_CHANNELS.includes(ch) && ['missing', 'deactivated', 'paused', 'unknown'].includes(cells[ch].state)) issues++;
    }
    rows.push({ brandName, locationCode, cells, issues });
  }
  return rows.sort((a, b) => a.brandName.localeCompare(b.brandName, 'fr') || locOrder.indexOf(a.locationCode) - locOrder.indexOf(b.locationCode));
}


function sum(list: StoredOrder[]) { return round2(list.reduce((s, o) => s + (Number(o.total) || 0), 0)); }

function shortId(o: StoredOrder) { return o.displayId || o.externalOrderId.slice(0, 8); }

export function deadlineFor(o: StoredOrder): string | null {
  const min = ORDER_DEADLINE_MIN[o.channel];
  return min ? new Date(new Date(o.createdAt).getTime() + min * 60_000).toISOString() : null;
}

export async function buildCommandCenter(opts: { now?: number; locationCodes?: string[] } = {}) {
  const now = opts.now ?? Date.now();
  const scope = opts.locationCodes?.length ? opts.locationCodes : undefined;
  const repo = getRepo();
  const catalog = await getCatalog();
  const LOCATIONS = catalog.locations.filter((l) => l.active && (!scope || scope.includes(l.code))).map((l) => ({ code: l.code, name: l.name, address_line_1: l.address }));
  const locName = (code?: string | null) => (!code ? 'unmapped store' : catalog.locations.find((l) => l.code === code)?.name ?? code);
  const prepSettings = await getPrepSettings();
  const tz = foodhubTimeZone();
  const dayStart = startOfLocalDayMs(now);
  const yStart = startOfLocalDayMs(dayStart - 3600_000);
  const sinceYesterday = new Date(yStart).toISOString();

  const [allOrders, stores, jobs, sync] = await Promise.all([
    repo.listOrders({ since: sinceYesterday, limit: 5000, locationCodes: scope }),
    repo.listStores().then((list) => list.filter((s) => !scope || scope.includes(s.locationCode))),
    repo.listJobs(200),
    lastSyncReport(),
  ]);
  const today = allOrders.filter((o) => new Date(o.createdAt).getTime() >= dayStart);
  const yesterday = allOrders.filter((o) => { const t = new Date(o.createdAt).getTime(); return t >= yStart && t < dayStart; });
  const yesterdaySameTime = yesterday.filter((o) => new Date(o.createdAt).getTime() - yStart <= now - dayStart);
  const counted = today.filter(COUNTED);
  const live = liveConnectorsGloballyEnabled();

  // ---------- Clover in-store (from the last sync, only if it is from today's business day) ----------
  const cloverFresh: SyncReport['clover'] = sync && new Date(sync.businessDayStart).getTime() === dayStart ? sync.clover : [];
  const inStore = round2(cloverFresh.filter((c) => c.ok).reduce((s, c) => s + c.net, 0));
  const cloverInfo = cloverReadiness();

  // ---------- KPIs ----------
  const deliverySales = sum(counted);
  const kpis = {
    deliverySales,
    deliveryOrders: counted.length,
    avgTicket: counted.length ? round2(deliverySales / counted.length) : 0,
    yesterdaySameTime: sum(yesterdaySameTime.filter(COUNTED)),
    openOrders: today.filter((o) => OPEN.includes(o.status)).length,
    newOrders: today.filter((o) => o.status === 'new').length,
    cancelled: today.filter((o) => o.status === 'cancelled').length,
    inStore,
    inStorePayments: cloverFresh.reduce((s, c) => s + (c.ok ? c.payments : 0), 0),
    combinedSales: round2(deliverySales + inStore),
    storesMapped: stores.length,
    storesOnline: stores.filter((s) => storeState(s).state === 'online').length,
    storesPaused: stores.filter((s) => storeState(s).state === 'paused').length,
    storesDeactivated: stores.filter((s) => storeState(s).state === 'deactivated').length,
  };

  // ---------- Channels ----------
  const channels = CHANNEL_KEYS.map((ch) => {
    const r = ADAPTERS[ch].readiness();
    const chOrders = counted.filter((o) => o.channel === ch);
    const chStores = stores.filter((s) => s.channel === ch);
    return {
      channel: ch,
      label: CHANNEL_LABELS[ch],
      configured: r.configured,
      canSend: r.canSend,
      missing: r.missing,
      note: r.note,
      orders: chOrders.length,
      sales: sum(chOrders),
      open: today.filter((o) => o.channel === ch && OPEN.includes(o.status)).length,
      storesMapped: chStores.length,
      storesOnline: chStores.filter((s) => storeState(s).state === 'online').length,
      lastOrderAt: today.find((o) => o.channel === ch)?.createdAt ?? null,
    };
  });

  // ---------- Breakdowns ----------
  const brandMap = new Map<string, { brandName: string; orders: number; sales: number }>();
  for (const o of counted) {
    const k = o.brandName || 'Unmapped store';
    const b = brandMap.get(k) ?? { brandName: k, orders: 0, sales: 0 };
    b.orders++; b.sales = round2(b.sales + Number(o.total || 0));
    brandMap.set(k, b);
  }
  const byBrand = [...brandMap.values()].sort((a, b) => b.sales - a.sales);

  const byLocation = LOCATIONS.map((l) => {
    const list = counted.filter((o) => o.locationCode === l.code);
    const clover = cloverFresh.filter((c) => c.ok && c.locationCodes.length === 1 && c.locationCodes[0] === l.code);
    return { locationCode: l.code, name: l.name, address: l.address_line_1, orders: list.length, sales: sum(list), inStore: round2(clover.reduce((s, c) => s + c.net, 0)) };
  });

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, orders: 0, yesterday: 0 }));
  for (const o of counted) { const h = localHour(new Date(o.createdAt).getTime(), tz); byHour[h].sales = round2(byHour[h].sales + Number(o.total || 0)); byHour[h].orders++; }
  for (const o of yesterday.filter(COUNTED)) { const h = localHour(new Date(o.createdAt).getTime(), tz); byHour[h].yesterday = round2(byHour[h].yesterday + Number(o.total || 0)); }

  // ---------- Action queue ----------
  const rank: Record<string, number> = { new: 0, accepted: 1, ready: 2, dispatched: 3 };
  const waitRank = (o: StoredOrder) => (isWaitingScheduled(o, now) ? 10 : 0);
  const queue = today
    .filter((o) => OPEN.includes(o.status))
    .sort((a, b) => (rank[a.status] ?? 3) + waitRank(a) - ((rank[b.status] ?? 3) + waitRank(b)) || (a.timeline?.fireAt ?? a.createdAt).localeCompare(b.timeline?.fireAt ?? b.createdAt))
    .slice(0, 40)
    .map((o) => ({
      id: o.id, channel: o.channel, displayId: shortId(o), brandName: o.brandName ?? null, locationCode: o.locationCode ?? null,
      status: o.status, total: o.total, fulfillment: o.fulfillment, customerName: o.customerName ?? null, createdAt: o.createdAt,
      deadlineAt: o.status === 'new' ? deadlineFor(o) : null, posOrderId: o.posOrderId ?? null, posError: o.posError ?? null, channelError: o.channelError ?? null,
      notes: o.notes ?? null, items: o.lines.reduce((s, l) => s + l.quantity, 0),
      lines: o.lines.slice(0, 6).map((l) => ({ quantity: l.quantity, name: l.name, modifiers: l.modifiers.map((m) => m.name) })),
      moreLines: Math.max(0, o.lines.length - 6),
      readyTarget: o.timeline?.readyTarget ?? null,
      scheduledFor: o.timeline?.scheduledFor ?? null,
      fireAt: o.timeline?.fireAt ?? null,
      waitingScheduled: isWaitingScheduled(o, now),
      courier: o.timeline?.courier ?? null,
      posPaid: Boolean(o.timeline?.posPaymentId),
      actions: allowedActions(o),
    }));

  // ---------- Matrix ----------
  const matrix = buildMatrix(stores, LOCATIONS.map((l) => l.code), scope);

  // ---------- Alerts ----------
  const alerts: Alert[] = [];
  for (const o of today.filter((x) => x.status === 'new')) {
    const ageS = (now - new Date(o.createdAt).getTime()) / 1000;
    if (ageS < 45) continue;
    const deadline = deadlineFor(o);
    const left = deadline ? (new Date(deadline).getTime() - now) / 1000 : null;
    alerts.push({
      id: `new:${o.id}`,
      severity: left !== null && left < 180 ? 'critical' : 'warning',
      title: left !== null && left <= 0 ? `${CHANNEL_LABELS[o.channel]} #${shortId(o)} passed its answer deadline` : `${CHANNEL_LABELS[o.channel]} #${shortId(o)} is waiting to be accepted`,
      detail: `${o.brandName ?? 'Unmapped store'} · ${locName(o.locationCode)}${o.channel === 'skip' ? ' · Skip sends it to the tablet after 5 min' : ''}`,
      at: o.createdAt, orderId: o.id,
    });
  }
  for (const o of today.filter((x) => x.posError && !x.posOrderId && OPEN.includes(x.status))) {
    alerts.push({ id: `pos:${o.id}`, severity: 'critical', title: `Clover did not receive ${CHANNEL_LABELS[o.channel]} #${shortId(o)}`, detail: o.posError ?? undefined, at: o.createdAt, orderId: o.id });
  }
  for (const o of today.filter((x) => x.status === 'failed' && x.channel === 'skip' && now - new Date(x.updatedAt).getTime() < 3 * 3600_000)) {
    alerts.push({ id: `tablet:${o.id}`, severity: 'warning', title: `SkipTheDishes #${shortId(o)} is on the Skip tablet`, detail: `${o.brandName ?? 'Unmapped store'} · ${locName(o.locationCode)} — make it from the tablet (it is not in Clover).`, at: o.updatedAt, orderId: o.id });
  }
  for (const o of today.filter((x) => x.channelError && OPEN.includes(x.status))) {
    alerts.push({ id: `ch:${o.id}`, severity: 'warning', title: `${CHANNEL_LABELS[o.channel]} not updated for #${shortId(o)}`, detail: o.channelError ?? undefined, at: o.updatedAt, orderId: o.id });
  }
  const unmapped = new Map<string, StoredOrder>();
  for (const o of today.filter((x) => !x.locationCode)) unmapped.set(`${o.channel}|${o.channelStoreId}`, o);
  for (const o of unmapped.values()) {
    alerts.push({ id: `unmapped:${o.channel}:${o.channelStoreId}`, severity: 'warning', title: `Orders from an unmapped ${CHANNEL_LABELS[o.channel]} store`, detail: `Store id ${o.channelStoreId || '(none)'} — add it under Stores so orders get the right brand, location and Clover.`, href: '/dashboard/food-hub/stores', at: o.createdAt });
  }
  if (kpis.cancelled) alerts.push({ id: 'cancelled', severity: 'info', title: `${kpis.cancelled} order(s) cancelled today`, href: '/dashboard/food-hub/board' });

  for (const s of stores) {
    const st = storeState(s);
    const ps = s.meta?.platformStatus as PlatformStatus | undefined;
    const name = `${s.brandName} · ${locName(s.locationCode)} on ${CHANNEL_LABELS[s.channel]}`;
    if (st.state === 'deactivated') alerts.push({ id: `deact:${s.id}`, severity: 'critical', title: `${name} is DEACTIVATED`, detail: [st.detail, ps?.error].filter(Boolean).join(' — ') || undefined, href: '/dashboard/food-hub/stores', at: st.checkedAt });
    else if (st.state === 'paused' && ps?.source !== 'dashboard') alerts.push({ id: `pause:${s.id}`, severity: 'warning', title: `${name} was paused by the platform`, detail: st.detail, href: '/dashboard/food-hub/stores', at: st.checkedAt });
    else if (st.state === 'paused') alerts.push({ id: `pause:${s.id}`, severity: 'info', title: `${name} paused from TAKATAK`, detail: st.until ? `Re-opens automatically at ${new Date(st.until).toLocaleTimeString('fr-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}` : 'Until you resume it', href: '/dashboard/food-hub/stores' });
    if (ps?.error && st.state !== 'deactivated') alerts.push({ id: `syncerr:${s.id}`, severity: 'warning', title: `Could not read ${name}`, detail: ps.error, href: '/dashboard/food-hub/channels', at: ps.checkedAt });
  }

  for (const ch of REQUIRED_CHANNELS) {
    const missing = matrix.filter((r) => r.cells[ch].state === 'missing').length;
    if (missing) alerts.push({ id: `missing:${ch}`, severity: 'warning', title: `${CHANNEL_LABELS[ch]} not connected for ${missing} brand/location${missing > 1 ? 's' : ''}`, detail: 'Required service (DoorDash + Uber Eats + SkipTheDishes for every brand/location). Map the store id under Stores.', href: '/dashboard/food-hub/stores' });
  }
  const ddSeedDeact = matrix.filter((r) => r.cells.doordash.source === 'screenshot' && r.cells.doordash.state === 'deactivated').length;
  if (ddSeedDeact) alerts.push({ id: 'seed:dd-deact', severity: 'warning', title: `DoorDash: ${ddSeedDeact} brand/location${ddSeedDeact > 1 ? 's' : ''} deactivated (from your screenshots)`, detail: 'Not yet verified live — map the DoorDash store ids so Food Hub checks them automatically.', href: '/dashboard/food-hub/stores' });

  for (const c of channels) {
    if (!c.configured) alerts.push({ id: `cfg:${c.channel}`, severity: 'info', title: `${c.label} not connected yet`, detail: `Needs ${c.missing.join(', ')} — run npm run food-hub:setup.`, href: '/dashboard/food-hub/channels' });
  }
  if (!cloverInfo.configured) alerts.push({ id: 'cfg:clover', severity: 'warning', title: 'Clover not connected — delivery orders will not reach the kitchen POS', detail: `Needs ${cloverInfo.missing.join(', ')}.`, href: '/dashboard/food-hub/channels' });
  for (const c of cloverFresh.filter((x) => !x.ok)) alerts.push({ id: `clover:${c.merchantId}`, severity: 'warning', title: `Clover sales unavailable for merchant ${c.merchantId}`, detail: c.error });
  if (!live && channels.some((c) => c.configured)) alerts.push({ id: 'live-off', severity: 'warning', title: 'Live switch is OFF', detail: 'Orders are received, but nothing is sent back to the platforms (no accept, no menu, no pause). Set LIVE_CONNECTORS_GLOBAL_ENABLED=true.', href: '/dashboard/food-hub/channels' });

  const dayAgo = new Date(now - 24 * 3600_000).toISOString();
  const unparsed = jobs.filter((j) => j.kind === 'webhook_unparsed' && j.createdAt >= dayAgo);
  if (unparsed.length) alerts.push({ id: 'unparsed', severity: 'warning', title: `${unparsed.length} webhook payload(s) could not be read`, detail: 'Kept safely — see Channels → Unparsed payloads.', href: '/dashboard/food-hub/channels' });
  const failedJobs = jobs.filter((j) => j.status === 'error' && j.kind !== 'webhook_unparsed' && j.createdAt >= dayAgo);
  if (failedJobs.length) alerts.push({ id: 'jobs-failed', severity: 'warning', title: `${failedJobs.length} menu/item/store action(s) failed in the last 24 h`, detail: [...new Set(failedJobs.map((j) => `${CHANNEL_LABELS[j.channel as ChannelKey] ?? j.channel} ${j.kind.replace('_', ' ')}`))].join(', '), href: '/dashboard/food-hub/channels' });
  const stuck = jobs.filter((j) => j.status === 'queued' && now - new Date(j.createdAt).getTime() > 30 * 60_000 && j.createdAt >= dayAgo);
  if (stuck.length) alerts.push({ id: 'jobs-stuck', severity: 'info', title: `${stuck.length} platform confirmation(s) still pending after 30 min`, href: '/dashboard/food-hub/channels' });

  const polledStores = stores.filter((s) => s.channel === 'uber_eats' || s.channel === 'doordash').length;
  if (polledStores && (!sync || now - new Date(sync.at).getTime() > 15 * 60_000)) {
    alerts.push({ id: 'sync-stale', severity: 'warning', title: sync ? 'Store status not refreshed for 15+ min' : 'Store status never synced yet', detail: 'Keep this screen open (it syncs every 2 min) or schedule /api/food-hub/cron/sync.' });
  }

  // Clover bookkeeping, inventory sync and money
  const unpaid = today.filter((o) => o.posOrderId && !o.timeline?.posPaymentId && o.timeline?.posPaymentError && o.status !== 'cancelled');
  if (unpaid.length) alerts.push({ id: 'clover-unpaid', severity: 'warning', title: `${unpaid.length} delivery order(s) not recorded as paid in Clover`, detail: unpaid[0].timeline?.posPaymentError, href: '/dashboard/food-hub/channels' });
  const priceChanges = await listCloverPriceChanges().catch(() => []);
  if (priceChanges.length) alerts.push({ id: 'clover-prices', severity: 'info', title: `${priceChanges.length} price(s) changed in Clover`, detail: priceChanges.slice(0, 3).map((c) => `${c.name} (${c.brandName}): ${c.foodhubPrice.toFixed(2)} → ${c.cloverPrice.toFixed(2)} $`).join(' · '), href: '/dashboard/food-hub/menu' });
  const verification = await repo.getKv<{ code: string; at: string }>(VERIFY_KEY).catch(() => null);
  if (verification && !process.env.CLOVER_WEBHOOK_AUTH) alerts.push({ id: 'clover-verify', severity: 'info', title: 'Finish connecting Clover webhooks', detail: 'Clover sent a verification code — see Channels & Setup.', href: '/dashboard/food-hub/channels', at: verification.at });
  for (const s of stores.filter((x) => x.meta?.provisioned === false)) {
    alerts.push({ id: `deprov:${s.id}`, severity: 'critical', title: `${s.brandName} · ${locName(s.locationCode)} was disconnected by ${CHANNEL_LABELS[s.channel]}`, detail: 'Orders from this store no longer reach Food Hub or Clover. Reconnect it under Stores.', href: '/dashboard/food-hub/stores' });
  }
  if (!scope) {
    const all = await listCases({ status: ['open', 'disputed'] }).catch(() => []);
    const cases = all.filter((c) => RECOVERABLE.includes(c.type));
    const unknown = all.filter((c) => c.type === 'unknown_order').length;
    const owed = Math.round(cases.reduce((a, c) => a + c.amount, 0) * 100) / 100;
    if (cases.length) alerts.push({ id: 'recon-cases', severity: 'warning', title: `${owed.toFixed(2)} $ to recover from the platforms (${cases.length} case${cases.length > 1 ? 's' : ''})`, detail: `Short payouts, missing orders, error charges — see Disputes.${unknown ? ` Also ${unknown} paid order(s) Food Hub never received — check the store mapping.` : ''}`, href: '/dashboard/food-hub/finance/disputes' });
    else if (unknown) alerts.push({ id: 'recon-unknown', severity: 'warning', title: `${unknown} paid order(s) on the statements that Food Hub never received`, detail: 'A webhook was missed or a store is not mapped — see Disputes.', href: '/dashboard/food-hub/finance/disputes' });
  }

  const sevRank = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || (b.at ?? '').localeCompare(a.at ?? ''));

  const kitchen = LOCATIONS.map((l) => {
    const p = { ...DEFAULT_PREP, ...prepSettings[l.code] };
    return { locationCode: l.code, name: l.name, isBusy: p.isBusy, normal: p.normal, busy: p.busy, minutes: p.isBusy ? p.busy : p.normal };
  });

  return {
    kitchen,
    scoped: Boolean(scope),
    generatedAt: new Date(now).toISOString(),
    businessDay: localDateLabel(now, tz),
    timezone: tz,
    mode: repo.mode,
    liveEnabled: live,
    dashboardProtected: true,
    kpis,
    channels,
    clover: { configured: cloverInfo.configured, merchants: cloverFresh.map((c) => ({ merchantId: c.merchantId, ok: c.ok, net: c.net, payments: c.payments, error: c.error ?? null, locationCodes: c.locationCodes })) },
    byBrand,
    byLocation,
    byHour,
    queue,
    matrix,
    matrixSummary: {
      rows: matrix.length,
      complete: matrix.filter((r) => r.issues === 0).length,
      brands: catalog.brands.filter((b) => b.active).length,
    },
    alerts,
    alertCounts: { critical: alerts.filter((a) => a.severity === 'critical').length, warning: alerts.filter((a) => a.severity === 'warning').length, info: alerts.filter((a) => a.severity === 'info').length },
    lastSync: sync ? { at: sync.at, trigger: sync.trigger, durationMs: sync.durationMs, polled: sync.stores.filter((s) => s.polled).length, errors: sync.stores.filter((s) => !s.ok).length + sync.clover.filter((c) => !c.ok).length } : null,
    recent: today.slice(0, 12).map((o) => ({ id: o.id, channel: o.channel, displayId: shortId(o), brandName: o.brandName ?? null, locationCode: o.locationCode ?? null, status: o.status, total: o.total, createdAt: o.createdAt })),
  };
}

export type CommandCenter = Awaited<ReturnType<typeof buildCommandCenter>>;
