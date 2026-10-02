// Analytics (Atlas Analytics module): any date range vs the previous period, filtered by
// location, platform and brand. Revenue, orders, AOV, lost orders, cancellations (who / stage / why),
// items, day × hour heatmap, AOV distribution, operations (time to accept, prep), store uptime
// during opening hours, and new vs repeat customers.
import { getCatalog } from './catalog';
import { CHANNEL_LABELS } from './config';
import { effectiveHours, getHours, holidaysFor, localDate, openIntervals } from './hours';
import { getRepo } from './repo';
import { foodhubTimeZone, localParts, startOfLocalDayMs } from './time';
import type { ActivityEntry, ChannelKey, ChannelStore, StoredOrder } from './types';

export interface AnalyticsQuery {
  from: string;
  to: string;
  locationCodes?: string[];
  channels?: ChannelKey[];
  brands?: string[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b ? r2((a / b) * 100) : 0);
const change = (cur: number, prev: number) => (prev ? r2(((cur - prev) / prev) * 100) : cur ? 100 : 0);
const COUNTED = (o: StoredOrder) => o.status !== 'cancelled';
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Customer id when the platform shares one (Uber eater id, DoorDash consumer id, Skip/TGTG customer id). */
export function customerKey(o: StoredOrder): string | null {
  const raw = (o.raw ?? {}) as Record<string, any>;
  const id = raw.eater?.id ?? raw.consumer?.id ?? raw.customer?.id ?? raw.order?.consumer?.id ?? null;
  return id ? `${o.channel}:${id}` : null;
}

function filterOrders(list: StoredOrder[], q: AnalyticsQuery) {
  return list.filter((o) =>
    (!q.channels?.length || q.channels.includes(o.channel)) &&
    (!q.brands?.length || (o.brandName && q.brands.includes(o.brandName))));
}

function summary(orders: StoredOrder[], days: number) {
  const counted = orders.filter(COUNTED);
  const lost = orders.filter((o) => o.status === 'cancelled');
  const sales = r2(counted.reduce((s, o) => s + (Number(o.total) || 0), 0));
  const accepted = orders.filter((o) => o.timeline?.acceptedAt);
  const acceptMins = accepted.map((o) => (new Date(o.timeline!.acceptedAt!).getTime() - new Date(o.createdAt).getTime()) / 60000).filter((m) => m >= 0);
  const prepMins = orders.filter((o) => o.timeline?.acceptedAt && o.timeline?.readyAt).map((o) => (new Date(o.timeline!.readyAt!).getTime() - new Date(o.timeline!.acceptedAt!).getTime()) / 60000).filter((m) => m >= 0);
  return {
    sales,
    orders: counted.length,
    aov: counted.length ? r2(sales / counted.length) : 0,
    salesPerDay: days ? r2(sales / days) : sales,
    completed: orders.filter((o) => o.status === 'completed' || o.status === 'dispatched').length,
    lostOrders: lost.length,
    lostRevenue: r2(lost.reduce((s, o) => s + (Number(o.total) || 0), 0)),
    cancelRate: pct(lost.length, orders.length),
    avgAcceptMin: acceptMins.length ? r2(acceptMins.reduce((a, b) => a + b, 0) / acceptMins.length) : 0,
    medianAcceptMin: r2(median(acceptMins)),
    autoAcceptRate: pct(orders.filter((o) => o.timeline?.acceptedBy === 'auto').length, accepted.length),
    avgPrepMin: prepMins.length ? r2(prepMins.reduce((a, b) => a + b, 0) / prepMins.length) : 0,
    cloverRate: pct(orders.filter((o) => o.posOrderId).length, orders.length),
    platformErrors: orders.filter((o) => o.channelError && o.status !== 'failed').length,
  };
}

// ---------- store uptime during opening hours ----------

type Interval = [number, number];
const OFF_ACTIONS: Record<string, 'online' | 'offline' | 'closed'> = {
  pause: 'offline', resume: 'online', platform_online: 'online', platform_paused: 'offline', platform_deactivated: 'offline', platform_closed: 'closed', platform_unknown: 'online',
};

function intersectIntervals(a: Interval[], b: Interval[]): number {
  let total = 0;
  for (const [s1, e1] of a) for (const [s2, e2] of b) { const s = Math.max(s1, s2); const e = Math.min(e1, e2); if (e > s) total += e - s; }
  return total;
}

/** Offline intervals of one store in [from, to) from its status-change history. */
export function offlineIntervals(entries: ActivityEntry[], storeId: string, from: number, to: number, initial: 'online' | 'offline' | 'closed' = 'online', countClosed = true): Interval[] {
  const changes = entries.filter((e) => e.storeId === storeId && e.kind === 'store_status' && OFF_ACTIONS[e.action] && e.status !== 'failed')
    .map((e) => ({ t: new Date(e.at).getTime(), state: OFF_ACTIONS[e.action] })).sort((x, y) => x.t - y.t);
  let state = initial;
  for (const c of changes) if (c.t <= from) state = c.state;
  const out: Interval[] = [];
  let cursor = from;
  const isOff = (s: string) => s === 'offline' || (countClosed && s === 'closed');
  for (const c of changes.filter((x) => x.t > from && x.t < to)) {
    if (isOff(state)) out.push([cursor, c.t]);
    state = c.state; cursor = c.t;
  }
  if (isOff(state)) out.push([cursor, to]);
  return out;
}

export async function buildAnalytics(q: AnalyticsQuery, now = Date.now()) {
  const tz = foodhubTimeZone();
  const from = Date.parse(q.from); const to = Math.min(Date.parse(q.to), Math.max(now, Date.parse(q.from) + 1));
  const span = Date.parse(q.to) - from;
  const prevFrom = from - span; const prevTo = from;
  const days = Math.max(1, Math.round(span / 86400_000));
  const repo = getRepo();
  const [catalog, hours, curRaw, prevRaw, stores, history] = await Promise.all([
    getCatalog(),
    getHours(),
    repo.listOrders({ since: new Date(from).toISOString(), until: q.to, limit: 50_000, locationCodes: q.locationCodes }),
    repo.listOrders({ since: new Date(prevFrom).toISOString(), until: new Date(prevTo).toISOString(), limit: 50_000, locationCodes: q.locationCodes }),
    repo.listStores(),
    repo.listOrders({ since: new Date(from - 90 * 86400_000).toISOString(), until: new Date(from).toISOString(), limit: 50_000, locationCodes: q.locationCodes }),
  ]);
  const cur = filterOrders(curRaw, q);
  const prev = filterOrders(prevRaw, q);
  const locName = (code?: string | null) => (code ? catalog.locations.find((l) => l.code === code)?.name ?? code : 'Unmapped store');

  // KPIs
  const k = summary(cur, days);
  const p = summary(prev, days);
  const kpis = Object.fromEntries(Object.entries(k).map(([key, v]) => [key, { value: v, previous: (p as Record<string, number>)[key], change: change(v, (p as Record<string, number>)[key]) }]));

  // Daily series (current vs previous period aligned by day index)
  const dayIndex = (t: number, start: number) => Math.floor((startOfLocalDayMs(t, tz) - startOfLocalDayMs(start, tz) + 12 * 3600_000) / 86400_000);
  const daily = Array.from({ length: days }, (_, i) => ({ date: localDate(startOfLocalDayMs(from, tz) + i * 86400_000 + 12 * 3600_000, tz), sales: 0, orders: 0, prevSales: 0, prevOrders: 0 }));
  for (const o of cur.filter(COUNTED)) { const i = dayIndex(new Date(o.createdAt).getTime(), from); if (daily[i]) { daily[i].sales = r2(daily[i].sales + o.total); daily[i].orders++; } }
  for (const o of prev.filter(COUNTED)) { const i = dayIndex(new Date(o.createdAt).getTime(), prevFrom); if (daily[i]) { daily[i].prevSales = r2(daily[i].prevSales + o.total); daily[i].prevOrders++; } }

  // Breakdowns
  const group = <K extends string>(keyOf: (o: StoredOrder) => K | null | undefined, label: (k: K) => string) => {
    const m = new Map<K, { key: K; label: string; sales: number; orders: number; lostOrders: number; lostRevenue: number; prevSales: number }>();
    const get = (key: K) => m.get(key) ?? m.set(key, { key, label: label(key), sales: 0, orders: 0, lostOrders: 0, lostRevenue: 0, prevSales: 0 }).get(key)!;
    for (const o of cur) { const key = keyOf(o); if (!key) continue; const g = get(key); if (COUNTED(o)) { g.sales = r2(g.sales + o.total); g.orders++; } else { g.lostOrders++; g.lostRevenue = r2(g.lostRevenue + o.total); } }
    for (const o of prev.filter(COUNTED)) { const key = keyOf(o); if (!key) continue; const g = get(key); g.prevSales = r2(g.prevSales + o.total); }
    return [...m.values()].map((g) => ({ ...g, aov: g.orders ? r2(g.sales / g.orders) : 0, share: pct(g.sales, k.sales), change: change(g.sales, g.prevSales) })).sort((a, b) => b.sales - a.sales);
  };
  const byChannel = group((o) => o.channel, (c) => CHANNEL_LABELS[c as ChannelKey]);
  const byBrand = group((o) => o.brandName ?? 'Unmapped store', (b) => b);
  const byLocation = group((o) => o.locationCode ?? 'UNMAPPED', (c) => locName(c === 'UNMAPPED' ? null : c));

  // Items
  const itemMap = new Map<string, { name: string; brand: string; qty: number; revenue: number; orders: number; prevQty: number; lostQty: number }>();
  const itemOf = (o: StoredOrder, l: StoredOrder['lines'][number]) => {
    const key = `${o.brandName ?? ''}|${l.externalId || l.name}`;
    return itemMap.get(key) ?? itemMap.set(key, { name: l.name, brand: o.brandName ?? '', qty: 0, revenue: 0, orders: 0, prevQty: 0, lostQty: 0 }).get(key)!;
  };
  for (const o of cur) for (const l of o.lines) { const it = itemOf(o, l); if (COUNTED(o)) { it.qty += l.quantity; it.revenue = r2(it.revenue + l.total); it.orders++; } else it.lostQty += l.quantity; }
  for (const o of prev.filter(COUNTED)) for (const l of o.lines) itemOf(o, l).prevQty += l.quantity;
  const items = [...itemMap.values()].filter((i) => i.qty > 0).map((i) => ({ ...i, change: change(i.qty, i.prevQty) })).sort((a, b) => b.revenue - a.revenue).slice(0, 25);
  const lostItems = [...itemMap.values()].filter((i) => i.lostQty > 0).sort((a, b) => b.lostQty - a.lostQty).slice(0, 10).map((i) => ({ name: i.name, brand: i.brand, qty: i.lostQty }));

  // Heatmap day-of-week × hour (orders), Monday first
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const o of cur.filter(COUNTED)) {
    const t = new Date(o.createdAt).getTime(); const lp = localParts(t, tz);
    const dow = (new Date(Date.UTC(lp.year, lp.month - 1, lp.day)).getUTCDay() + 6) % 7;
    heatmap[dow][lp.hour]++;
  }

  // AOV distribution
  const edges = [0, 10, 20, 30, 40, 50, 75, 100, Infinity];
  const aovBuckets = edges.slice(0, -1).map((lo, i) => ({ label: edges[i + 1] === Infinity ? `$${lo}+` : `$${lo}–${edges[i + 1]}`, orders: cur.filter(COUNTED).filter((o) => o.total >= lo && o.total < edges[i + 1]).length }));

  // Cancellations
  const cancelled = cur.filter((o) => o.status === 'cancelled');
  const count = <T extends string>(xs: T[]) => xs.reduce<Record<string, number>>((acc, x) => { acc[x] = (acc[x] ?? 0) + 1; return acc; }, {});
  const reasons = Object.entries(count(cancelled.map((o) => o.timeline?.cancelReason || 'Not given'))).map(([reason, n]) => ({ reason, count: n })).sort((a, b) => b.count - a.count).slice(0, 10);
  const cancellations = {
    total: cancelled.length,
    lostRevenue: r2(cancelled.reduce((s, o) => s + o.total, 0)),
    byWho: { store: 0, platform: 0, customer: 0, unknown: 0, ...count(cancelled.map((o) => o.timeline?.cancelledBy ?? 'unknown')) },
    byStage: { before_accept: 0, after_accept: 0, unknown: 0, ...count(cancelled.map((o) => o.timeline?.cancelStage ?? 'unknown')) },
    byChannel: Object.entries(count(cancelled.map((o) => o.channel))).map(([c, n]) => ({ channel: c, label: CHANNEL_LABELS[c as ChannelKey], count: n })),
    reasons,
  };

  // Store uptime during opening hours (from the activity log of status changes)
  const scopedStores = stores.filter((s: ChannelStore) => (!q.locationCodes?.length || q.locationCodes.includes(s.locationCode)) && (!q.channels?.length || q.channels.includes(s.channel)) && (!q.brands?.length || q.brands.includes(s.brandName)));
  const activity = await repo.listActivity({ since: new Date(from - 30 * 86400_000).toISOString(), until: new Date(to).toISOString(), kinds: ['store_status'], limit: 50_000 });
  const uptime = scopedStores.map((s) => {
    const week = effectiveHours(hours, s.brandName, s.locationCode);
    const open: Interval[] = week ? openIntervals(week, holidaysFor(hours, s.locationCode, localDate(from, tz), days + 1), from, to, tz) : [[from, to]];
    const openMs = open.reduce((a, [x, y]) => a + (y - x), 0);
    const off = offlineIntervals(activity, s.id, from, to, 'online', Boolean(week));
    const offMs = intersectIntervals(off, open);
    return { storeId: s.id, channel: s.channel, label: CHANNEL_LABELS[s.channel], brandName: s.brandName, locationCode: s.locationCode, location: locName(s.locationCode), hoursSet: Boolean(week),
      openMinutes: Math.round(openMs / 60000), offlineMinutes: Math.round(offMs / 60000), uptimePct: openMs ? r2(100 - (offMs / openMs) * 100) : 100 };
  }).sort((a, b) => a.uptimePct - b.uptimePct);
  const totalOpen = uptime.reduce((a, u) => a + u.openMinutes, 0);
  const totalOff = uptime.reduce((a, u) => a + u.offlineMinutes, 0);

  // Customers (only where the platform shares a customer id)
  const seenBefore = new Set(history.map(customerKey).filter(Boolean) as string[]);
  const keyed = cur.filter(COUNTED).map((o) => customerKey(o)).filter(Boolean) as string[];
  const perCustomer = count(keyed);
  const uniq = Object.keys(perCustomer);
  const repeat = uniq.filter((c) => seenBefore.has(c) || perCustomer[c] > 1).length;

  return {
    range: { from: new Date(from).toISOString(), to: q.to, days, previousFrom: new Date(prevFrom).toISOString(), previousTo: new Date(prevTo).toISOString(), timezone: tz },
    kpis,
    daily,
    byChannel,
    byBrand,
    byLocation,
    items,
    lostItems,
    heatmap,
    aovBuckets,
    cancellations,
    uptime: { overallPct: totalOpen ? r2(100 - (totalOff / totalOpen) * 100) : 100, offlineMinutes: totalOff, stores: uptime, hoursSetFor: uptime.filter((u) => u.hoursSet).length },
    customers: { identified: uniq.length, coveragePct: pct(keyed.length, cur.filter(COUNTED).length), newCustomers: uniq.length - repeat, repeatCustomers: repeat, repeatRate: pct(repeat, uniq.length) },
  };
}

export type Analytics = Awaited<ReturnType<typeof buildAnalytics>>;
