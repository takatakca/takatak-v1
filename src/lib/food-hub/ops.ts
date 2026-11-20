// Operations fan-out: one click in the dashboard → every connected channel.
// Every action is logged in the activity log (who, what, where, result) — Atlas "Store Action Report".
import { logActivity, resultStatus, SYSTEM_ACTOR, type Actor } from './activity';
import { getAdapter } from './adapters';
import { CHANNEL_LABELS, nowIso, result } from './config';
import { getHours, holidaysFor, localDate, publishContext } from './hours';
import { getMenuLanguages } from './menu/language';
import { getRepo } from './repo';
import { startOfLocalDayMs } from './time';
import type { ChannelKey, ChannelResult, ChannelStore, FoodHubJob, MasterMenu, PlatformStatus } from './types';

export interface FanOutRow { storeId: string; channel: ChannelKey; channelStoreId: string; brandName: string; locationCode: string; result: ChannelResult }

async function record(kind: FoodHubJob['kind'], store: ChannelStore, res: ChannelResult, request: Record<string, unknown>) {
  await getRepo().addJob({
    kind,
    channel: store.channel,
    reference: res.reference ?? null,
    status: res.status === 'queued' ? 'queued' : res.ok ? 'done' : 'error',
    request: { ...request, storeId: store.id, channelStoreId: store.channelStoreId },
    result: { status: res.status, message: res.message, httpStatus: res.httpStatus ?? null },
  });
}

function row(store: ChannelStore, res: ChannelResult): FanOutRow {
  return { storeId: store.id, channel: store.channel, channelStoreId: store.channelStoreId, brandName: store.brandName, locationCode: store.locationCode, result: res };
}

function logStore(actor: Actor, kind: 'store_status' | 'item_availability' | 'menu_publish', action: string, store: ChannelStore, res: ChannelResult, summary: string, detail: Record<string, unknown> = {}) {
  return logActivity({
    actor: actor.name, source: actor.source, kind, action, status: resultStatus(res),
    channel: store.channel, brandName: store.brandName, locationCode: store.locationCode, storeId: store.id,
    summary: `${summary} — ${store.brandName} · ${store.locationCode} on ${CHANNEL_LABELS[store.channel]}${res.ok ? '' : ` (${res.message})`}`,
    detail: { ...detail, channelStoreId: store.channelStoreId, result: { status: res.status, message: res.message } },
  });
}

export async function storesFor(filter: { brandName?: string; locationCode?: string; storeIds?: string[]; channels?: ChannelKey[]; locationCodes?: string[] }) {
  const all = await getRepo().listStores();
  return all.filter((s) =>
    (!filter.brandName || s.brandName === filter.brandName) &&
    (!filter.locationCode || s.locationCode === filter.locationCode) &&
    (!filter.locationCodes?.length || filter.locationCodes.includes(s.locationCode)) &&
    (!filter.storeIds?.length || filter.storeIds.includes(s.id)) &&
    (!filter.channels?.length || filter.channels.includes(s.channel)));
}

/** Refs 86'd at a location right now (timed 86s that already ended are ignored). */
export function offRefsAt(menu: MasterMenu, locationCode: string, now = Date.now()): Set<string> {
  const until = menu.unavailableUntil ?? {};
  return new Set((menu.unavailableByLocation?.[locationCode] ?? []).filter((ref) => !(until[`${locationCode}|${ref}`] && until[`${locationCode}|${ref}`] <= now)));
}

/** The menu as it should appear at one location: 86'd items and modifiers switched off. */
export function menuForLocation(menu: MasterMenu, locationCode: string, now = Date.now()): MasterMenu {
  const off = offRefsAt(menu, locationCode, now);
  if (off.size === 0) return menu;
  return {
    ...menu,
    items: menu.items.map((i) => (off.has(i.ref) ? { ...i, available: false } : i)),
    modifierGroups: menu.modifierGroups.map((g) => ({ ...g, modifiers: g.modifiers.map((m) => (off.has(m.ref) ? { ...m, available: false } : m)) })),
  };
}

/** Push the brand's master menu (with store hours, holidays, category schedules) to the mapped stores. */
export async function publishMenu(brandName: string, opts: { storeIds?: string[]; channels?: ChannelKey[]; locationCodes?: string[]; actor?: Actor } = {}): Promise<FanOutRow[]> {
  const actor = opts.actor ?? SYSTEM_ACTOR;
  const menu = await getRepo().getMenu(brandName);
  if (!menu) throw new Error(`No master menu saved for ${brandName}. Import from Clover or create items first.`);
  const stores = await storesFor({ brandName, storeIds: opts.storeIds, channels: opts.channels, locationCodes: opts.locationCodes });
  const hours = await getHours();
  const languages = await getMenuLanguages();
  const rows: FanOutRow[] = [];
  for (const store of stores) {
    const ctx = { ...(await publishContext(brandName, store.locationCode, hours)), language: store.channel === 'tgtg' ? 'en' as const : languages[store.channel] };
    const res = await getAdapter(store.channel).publishMenu(store, menuForLocation(menu, store.locationCode), ctx);
    await record('menu_push', store, res, { brandName, hoursSet: Boolean(ctx.hours), holidays: ctx.holidays.length });
    await logStore(actor, 'menu_publish', 'publish', store, res, `Menu published (${menu.items.length} items${ctx.hours ? '' : ', no store hours set'})`);
    rows.push(row(store, res));
  }
  return rows;
}

/**
 * 86 / un-86 items AND modifiers at a location (all channels), or everywhere when no location is given.
 * untilMs = automatic re-enable (Uber/Skip natively; DoorDash and the menu by Food Hub's sync).
 */
export async function setItemAvailability(brandName: string, refs: string[], available: boolean, opts: { locationCode?: string; untilMs?: number; actor?: Actor } = {}): Promise<FanOutRow[]> {
  const actor = opts.actor ?? SYSTEM_ACTOR;
  const repo = getRepo();
  const menu = await repo.getMenu(brandName);
  const modifierRefs = new Set((menu?.modifierGroups ?? []).flatMap((g) => g.modifiers.map((m) => m.ref)));
  const itemRefs = refs.filter((r) => !modifierRefs.has(r));
  const modRefs = refs.filter((r) => modifierRefs.has(r));
  const names = new Map<string, string>([...(menu?.items ?? []).map((i) => [i.ref, i.name] as [string, string]), ...(menu?.modifierGroups ?? []).flatMap((g) => g.modifiers.map((m) => [m.ref, m.name] as [string, string]))]);
  const label = refs.map((r) => names.get(r) ?? r).join(', ');
  if (menu) {
    const byLoc = { ...(menu.unavailableByLocation ?? {}) };
    const until = { ...(menu.unavailableUntil ?? {}) };
    const locations = opts.locationCode ? [opts.locationCode] : [...new Set([...(await storesFor({ brandName })).map((s) => s.locationCode), ...Object.keys(byLoc)])];
    for (const loc of locations) {
      const set = new Set(byLoc[loc] ?? []);
      for (const ref of refs) {
        if (available) { set.delete(ref); delete until[`${loc}|${ref}`]; } else {
          set.add(ref);
          if (opts.untilMs) until[`${loc}|${ref}`] = opts.untilMs; else delete until[`${loc}|${ref}`];
        }
      }
      byLoc[loc] = [...set];
    }
    await repo.saveMenu({ ...menu, unavailableByLocation: byLoc, unavailableUntil: until });
  }
  const stores = await storesFor({ brandName, locationCode: opts.locationCode });
  const rows: FanOutRow[] = [];
  for (const store of stores) {
    const adapter = getAdapter(store.channel);
    let res: ChannelResult = result(store.channel, 'skipped', 'Nothing to update.');
    if (itemRefs.length) res = await adapter.setItemAvailability(store, itemRefs, available, opts.untilMs, 'item');
    if (modRefs.length && (res.ok || !itemRefs.length)) {
      const m = await adapter.setItemAvailability(store, modRefs, available, opts.untilMs, 'modifier');
      res = itemRefs.length && m.ok ? { ...res, message: `${res.message}; modifiers: ${m.message}` } : m;
    }
    await record('item_toggle', store, res, { brandName, itemRefs, modifierRefs: modRefs, available, untilMs: opts.untilMs ?? null });
    await logStore(actor, 'item_availability', available ? 'item_on' : 'item_off', store, res,
      `${available ? 'Back in stock' : "86'd"}: ${label}${!available && opts.untilMs ? ` until ${new Date(opts.untilMs).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}` : ''}`, { refs });
    rows.push(row(store, res));
  }
  if (!stores.length) {
    await logActivity({ actor: actor.name, source: actor.source, kind: 'item_availability', action: available ? 'item_on' : 'item_off', status: 'info', brandName, locationCode: opts.locationCode ?? null,
      summary: `${available ? 'Back in stock' : "86'd"} in Food Hub only (no mapped stores): ${label} — ${brandName}${opts.locationCode ? ` · ${opts.locationCode}` : ''}` });
  }
  return rows;
}

/** Pause / resume stores on every channel. */
export async function setStoresOnline(storeIds: string[], online: boolean, opts: { untilMs?: number; reason?: string; actor?: Actor } = {}): Promise<FanOutRow[]> {
  const actor = opts.actor ?? SYSTEM_ACTOR;
  const repo = getRepo();
  const stores = await storesFor({ storeIds });
  const rows: FanOutRow[] = [];
  for (const store of stores) {
    const res = await getAdapter(store.channel).setStoreOnline(store, online, opts.untilMs, opts.reason);
    if (res.ok) {
      const until = !online && opts.untilMs ? new Date(opts.untilMs).toISOString() : null;
      const platformStatus: PlatformStatus = { state: online ? 'online' : 'paused', detail: online ? undefined : opts.reason || 'Paused from TAKATAK', until, checkedAt: nowIso(), source: 'dashboard' };
      await repo.updateStore(store.id, { online, pausedUntil: until, lastStatusSource: 'foodhub', meta: { ...store.meta, platformStatus, ...(opts.reason === HOLIDAY_REASON ? { holidayPause: localDate(Date.now()) } : {}) } });
    }
    await record('store_toggle', store, res, { online, untilMs: opts.untilMs ?? null, reason: opts.reason ?? null });
    await logStore(actor, 'store_status', online ? 'resume' : 'pause', store, res,
      online ? 'Store resumed' : `Store paused${opts.untilMs ? ` until ${new Date(opts.untilMs).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}` : ''}${opts.reason ? ` (${opts.reason})` : ''}`, { online, untilMs: opts.untilMs ?? null });
    rows.push(row(store, res));
  }
  return rows;
}

/** Re-opens stores whose timed pause has expired (for channels without native timed pause). */
export async function reopenExpiredPauses(): Promise<FanOutRow[]> {
  const stores = (await getRepo().listStores()).filter((s) => !s.online && s.pausedUntil && new Date(s.pausedUntil).getTime() <= Date.now());
  return stores.length ? setStoresOnline(stores.map((s) => s.id), true, { reason: 'Timed pause ended' }) : [];
}

/** Timed 86s that ended: switch the items back on everywhere (DoorDash has no native timer). */
export async function reenableExpiredItems(now = Date.now()): Promise<number> {
  let count = 0;
  for (const menu of await getRepo().listMenus()) {
    const expired = Object.entries(menu.unavailableUntil ?? {}).filter(([, t]) => t <= now);
    const byLoc = new Map<string, string[]>();
    for (const [key] of expired) { const [loc, ref] = key.split('|'); byLoc.set(loc, [...(byLoc.get(loc) ?? []), ref]); }
    for (const [loc, refs] of byLoc) {
      await setItemAvailability(menu.brandName, refs, true, { locationCode: loc, actor: SYSTEM_ACTOR });
      count += refs.length;
    }
  }
  return count;
}

export const HOLIDAY_REASON = 'Holiday closure';

/**
 * Closed holidays: Uber (holiday-hours) and DoorDash (special_hours) close by themselves once the menu
 * is published. Skip has no holiday API, so Food Hub takes Skip stores offline until the next day.
 */
export async function applyHolidayClosures(now = Date.now()): Promise<number> {
  const hours = await getHours();
  const today = localDate(now);
  const stores = (await getRepo().listStores()).filter((s) => s.channel === 'skip' && s.online && (s.meta as Record<string, unknown>)?.holidayPause !== today);
  const closing = stores.filter((s) => holidaysFor(hours, s.locationCode, today, 0).some((h) => h.date === today && h.closed));
  if (!closing.length) return 0;
  const nextMidnight = startOfLocalDayMs(startOfLocalDayMs(now) + 36 * 3600_000);
  await setStoresOnline(closing.map((s) => s.id), false, { untilMs: nextMidnight, reason: HOLIDAY_REASON, actor: SYSTEM_ACTOR });
  return closing.length;
}

/** Skip (JET Connect) menu status callback: mark the latest queued Skip menu push done/failed. */
export async function handleSkipMenuStatus(body: any): Promise<string> {
  const repo = getRepo();
  const jobs = (await repo.listJobs(200)).filter((j) => j.channel === 'skip' && j.kind === 'menu_push' && j.status === 'queued');
  const restaurants: string[] = Array.isArray(body?.restaurants) ? body.restaurants.map(String) : body?.restaurant ? [String(body.restaurant)] : [];
  const failed = /fail|error|reject/i.test(JSON.stringify(body?.status ?? body?.result ?? body?.errors ?? ''));
  const targets = restaurants.length ? jobs.filter((j) => restaurants.includes(String(j.request.channelStoreId))) : jobs.slice(0, 1);
  for (const job of targets) await repo.updateJob(job.id, { status: failed ? 'error' : 'done', result: { ...(job.result ?? {}), callback: body } });
  return `${targets.length} Skip menu job(s) updated`;
}

export function noStoresResult(channel: ChannelKey) {
  return result(channel, 'skipped', 'No mapped stores matched.');
}
