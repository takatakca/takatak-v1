'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, money, NotifyPanel, ReasonDialog, STATUS_LABEL, useCatalog, useMe, useNotify } from './ui';

// ---------- Types (mirror lib/food-hub/command.ts) ----------
type ChannelKey = 'uber_eats' | 'doordash' | 'skip' | 'tgtg';
type CellState = 'online' | 'paused' | 'closed' | 'deactivated' | 'unknown' | 'not_synced' | 'missing';
type Cell = { state: CellState; source: 'live' | 'screenshot' | 'none'; stores: number; storeIds: string[]; detail?: string; until?: string | null; checkedAt?: string };
type QueueOrder = {
  id: string; channel: ChannelKey; displayId: string; brandName: string | null; locationCode: string | null; status: string; total: number;
  fulfillment: string; customerName: string | null; createdAt: string; deadlineAt: string | null; posOrderId: string | null; posError: string | null;
  channelError: string | null; notes: string | null; items: number; lines: Array<{ quantity: number; name: string; modifiers: string[] }>; moreLines: number;
  readyTarget: string | null; actions: string[];
  scheduledFor: string | null; fireAt: string | null; waitingScheduled: boolean; posPaid: boolean;
  courier: { status: string; name?: string; etaAt?: string; vehicle?: string } | null;
};
const COURIER: Record<string, string> = { assigned: 'Courier assigned', arriving: 'Courier arriving', at_store: 'Courier at the store', picked_up: 'Picked up', delivered: 'Delivered', unassigned: 'Courier unassigned' };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
type Kitchen = { locationCode: string; name: string; isBusy: boolean; normal: number; busy: number; minutes: number };
type Alert = { id: string; severity: 'critical' | 'warning' | 'info'; title: string; detail?: string; href?: string; at?: string; orderId?: string };
type Data = {
  generatedAt: string; businessDay: string; timezone: string; mode: string; liveEnabled: boolean; dashboardProtected: boolean;
  kpis: {
    deliverySales: number; deliveryOrders: number; avgTicket: number; yesterdaySameTime: number; openOrders: number; newOrders: number; cancelled: number;
    inStore: number; inStorePayments: number; combinedSales: number; storesMapped: number; storesOnline: number; storesPaused: number; storesDeactivated: number;
  };
  channels: Array<{ channel: ChannelKey; label: string; configured: boolean; canSend: boolean; missing: string[]; note: string; orders: number; sales: number; open: number; storesMapped: number; storesOnline: number; lastOrderAt: string | null }>;
  clover: { configured: boolean; merchants: Array<{ merchantId: string; ok: boolean; net: number; payments: number; error: string | null; locationCodes: string[] }> };
  byBrand: Array<{ brandName: string; orders: number; sales: number }>;
  byLocation: Array<{ locationCode: string; name: string; address: string; orders: number; sales: number; inStore: number }>;
  byHour: Array<{ hour: number; sales: number; orders: number; yesterday: number }>;
  queue: QueueOrder[];
  matrix: Array<{ brandName: string; locationCode: string; cells: Record<ChannelKey, Cell>; issues: number }>;
  matrixSummary: { rows: number; complete: number; brands: number };
  alerts: Alert[];
  alertCounts: { critical: number; warning: number; info: number };
  lastSync: { at: string; trigger: string; durationMs: number; polled: number; errors: number } | null;
  kitchen: Kitchen[];
};

const CH: ChannelKey[] = ['uber_eats', 'doordash', 'skip', 'tgtg'];
const CH_SHORT: Record<ChannelKey, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash', skip: 'Skip', tgtg: 'TGTG' };
const LOC_SHORT: Record<string, string> = { NDG_MAIN: 'NDG 6280', NDG_6284: 'NDG 6284', HOCHELAGA: 'Hochelaga', SAINT_LEONARD: 'St-Léonard' };
const STATE_LABEL: Record<CellState, string> = { online: 'Open', closed: 'Closed', paused: 'Paused', deactivated: 'Off', unknown: '?', not_synced: '…', missing: '—' };
const STATE_HINT: Record<CellState, string> = {
  online: 'Active and taking orders', closed: 'Active but closed (outside hours) — Z rule', paused: 'Paused — not taking orders',
  deactivated: 'Deactivated on the platform', unknown: 'Status could not be read', not_synced: 'Mapped — waiting for first sync', missing: 'Not connected',
};
const SYNC_EVERY_MS = 120_000;
const ACTION_DONE: Record<string, string> = { accept: 'accepted', deny: 'rejected', ready: 'marked ready', dispatch: 'handed to courier', complete: 'completed', cancel: 'cancelled', retry_pos: 'sent to Clover', print: 'printed' };
const shortLoc = (code: string | null | undefined, locName: (c?: string | null) => string) => (code ? LOC_SHORT[code] ?? locName(code) : '—');
const REFRESH_MS = 5_000;

function sinceLabel(iso: string | null | undefined, now: number) {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

function countdown(deadline: string, now: number) {
  const s = Math.round((new Date(deadline).getTime() - now) / 1000);
  if (s <= 0) return { text: 'deadline passed', cls: 'late' };
  const m = Math.floor(s / 60); const r = s % 60;
  return { text: `${m}:${String(r).padStart(2, '0')} left`, cls: s < 180 ? 'late' : 'soon' };
}

export default function CommandCenter() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const notify = useNotify();
  const alertRef = useRef(notify.alert);
  useEffect(() => { alertRef.current = notify.alert; }, [notify.alert]);
  const [showNotify, setShowNotify] = useState(false);
  const [reasonFor, setReasonFor] = useState<{ order: QueueOrder; action: 'deny' | 'cancel' } | null>(null);
  const { locName } = useCatalog();
  const { can } = useMe();
  const [tv, setTv] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [locFilter, setLocFilter] = useState('');
  const [picked, setPicked] = useState<{ brandName: string; locationCode: string; channel: ChannelKey; cell: Cell } | null>(null);
  const [toast, setToast] = useState('');
  const seenNew = useRef<Set<string> | null>(null);
  const seenCritical = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<Data>('/api/food-hub/command');
      setError('');
      const newOrders = d.queue.filter((o) => o.status === 'new');
      const newIds = newOrders.map((o) => o.id);
      const critical = d.alerts.filter((a) => a.severity === 'critical');
      const fresh = seenNew.current ? newOrders.filter((o) => !seenNew.current!.has(o.id)) : [];
      const freshCritical = seenCritical.current ? critical.filter((a) => !seenCritical.current!.has(a.id)) : [];
      if (fresh.length) alertRef.current(`New ${CH_SHORT[fresh[0].channel]} order #${fresh[0].displayId}`, `${fresh[0].brandName ?? ''} · ${money(fresh[0].total)}${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''}`, 'order');
      else if (freshCritical.length) alertRef.current(freshCritical[0].title, freshCritical[0].detail ?? '', freshCritical[0].id.startsWith('cancel') ? 'cancel' : 'critical');
      seenNew.current = new Set(newIds);
      seenCritical.current = new Set(critical.map((a) => a.id));
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Repeat the alert every 20 s while any order is still waiting to be accepted (Atlas "repeat until acknowledged").
  const waiting = data?.queue.filter((o) => o.status === 'new').length ?? 0;
  useEffect(() => {
    if (!waiting || !notify.settings.repeat) return;
    const t = setInterval(() => alertRef.current(`${waiting} order(s) waiting`, 'Accept or reject them on the Command Center', 'order'), 20_000);
    return () => clearInterval(t);
  }, [waiting, notify.settings.repeat]);

  const sync = useCallback(async (force: boolean) => {
    setSyncing(true);
    try {
      const r = await api<{ ran: boolean; reason: string | null; report: { stores: unknown[]; durationMs: number } | null }>('/api/food-hub/sync', { method: 'POST', json: { force, trigger: force ? 'manual' : 'auto' } });
      setSyncMsg(r.ran ? `Synced ${r.report?.stores.length ?? 0} store(s) in ${((r.report?.durationMs ?? 0) / 1000).toFixed(1)} s` : r.reason ?? '');
    } catch (e) {
      setSyncMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
      load();
    }
  }, [load]);

  useEffect(() => { load(); const t = setInterval(load, REFRESH_MS); return () => clearInterval(t); }, [load]);
  useEffect(() => { sync(false); const t = setInterval(() => sync(false), SYNC_EVERY_MS); return () => clearInterval(t); }, [sync]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { document.body.classList.toggle('tv-mode', tv); return () => document.body.classList.remove('tv-mode'); }, [tv]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 5000); return () => clearTimeout(t); }, [toast]);

  function act(o: QueueOrder, action: string) {
    if (action === 'deny' && o.channel === 'skip') {
      if (window.confirm(`Hand Skip #${o.displayId} to the Skip tablet? (It is not cancelled — the kitchen makes it from the tablet.)`)) run(o, 'deny', { reason: 'Handled on Skip tablet' });
      return;
    }
    if (action === 'deny' || action === 'cancel') { setReasonFor({ order: o, action }); return; }
    run(o, action, {});
  }

  async function run(o: QueueOrder, action: string, extra: { reason?: string; reasonCode?: string }) {
    setBusy(o.id + action);
    try {
      const r = await api<{ result: { ok: boolean; message: string } }>(`/api/food-hub/orders/${o.id}`, { method: 'POST', json: { action, ...extra } });
      setToast(r.result.ok ? `#${o.displayId}: ${ACTION_DONE[action] ?? action} — ${r.result.message}` : `#${o.displayId}: ${r.result.message}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  async function setBusyMode(k: Kitchen, isBusy: boolean) {
    setBusy('kitchen' + k.locationCode);
    try {
      await api('/api/food-hub/prep', { method: 'POST', json: { locationCode: k.locationCode, isBusy } });
      setToast(`${k.name}: ${isBusy ? `busy mode ON — new orders get ${k.busy} min prep time` : `busy mode off — back to ${k.normal} min`}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  async function storeAction(online: boolean, minutes?: number) {
    if (!picked) return;
    setBusy('store');
    try {
      const r = await api<{ results: Array<{ result: { ok: boolean; message: string } }> }>('/api/food-hub/stores/status', { method: 'POST', json: { storeIds: picked.cell.storeIds, online, minutes, reason: online ? undefined : 'Paused from TAKATAK Command Center' } });
      const okCount = r.results.filter((x) => x.result.ok).length;
      setToast(`${picked.brandName} · ${shortLoc(picked.locationCode, locName)} · ${CH_SHORT[picked.channel]}: ${okCount}/${r.results.length} updated${okCount < r.results.length ? ` — ${r.results.find((x) => !x.result.ok)?.result.message}` : ''}`);
      setPicked(null);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  const rows = useMemo(() => (data?.matrix ?? []).filter((r) => (!issuesOnly || r.issues > 0) && (!locFilter || r.locationCode === locFilter)), [data, issuesOnly, locFilter]);
  const maxHour = useMemo(() => Math.max(1, ...(data?.byHour ?? []).flatMap((h) => [h.sales, h.yesterday])), [data]);
  const maxBrand = useMemo(() => Math.max(1, ...(data?.byBrand ?? []).map((b) => b.sales)), [data]);

  if (!data) {
    return (
      <div className="cc">
        <h1>TAKATAK Command Center</h1>
        {error ? <div className="fh-banner warn">Could not load: {error}</div> : <p className="small">Loading…</p>}
      </div>
    );
  }

  const k = data.kpis;
  const diff = k.deliverySales - k.yesterdaySameTime;
  const clock = new Intl.DateTimeFormat('en-CA', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(now));
  const curHour = Number(new Date(now).toLocaleString('en-CA', { timeZone: data.timezone, hour: '2-digit', hourCycle: 'h23' }));

  return (
    <div className="cc">
      {/* ---------- Header ---------- */}
      <header className="cc-top">
        <div>
          <h1>TAKATAK Command Center</h1>
          <div className="small cc-day">{data.businessDay} · <strong className="cc-clock">{clock}</strong></div>
        </div>
        <div className="fh-row">
          <span className={`cc-pill ${data.liveEnabled ? 'on' : 'off'}`} title="LIVE_CONNECTORS_GLOBAL_ENABLED">{data.liveEnabled ? '● LIVE' : '○ LIVE OFF'}</span>
          <span className={`cc-pill ${data.mode === 'supabase' ? 'on' : 'warn'}`} title={data.mode === 'supabase' ? 'Saved in Supabase' : 'Demo memory — lost on restart'}>{data.mode === 'supabase' ? 'Database' : 'Demo memory'}</span>
          <span className="cc-pill" title={syncMsg}>Status sync {sinceLabel(data.lastSync?.at, now)}{data.lastSync?.errors ? ` · ${data.lastSync.errors} err` : ''}</span>
          <button className="btn-sm" disabled={syncing} onClick={() => sync(true)}>{syncing ? 'Syncing…' : 'Sync now'}</button>
          <button className="btn-sm btn-light" onClick={() => setShowNotify(true)} title="Sound, repeat and desktop alerts for this screen">{notify.settings.sound ? '🔔 Alerts' : '🔕 Alerts'}</button>
          <button className="btn-sm btn-light" onClick={() => { setTv(!tv); if (!tv) document.documentElement.requestFullscreen?.().catch(() => undefined); else if (document.fullscreenElement) document.exitFullscreen?.(); }}>{tv ? 'Exit screen mode' : 'Screen mode'}</button>
        </div>
      </header>
      {error && <div className="fh-banner warn">Connection problem — showing the last data received ({error}).</div>}
      {toast && <div className="fh-banner info cc-toast">{toast}</div>}
      {showNotify && <NotifyPanel settings={notify.settings} update={notify.update} onClose={() => setShowNotify(false)} />}
      {reasonFor && (
        <ReasonDialog
          title={`${reasonFor.action === 'deny' ? 'Reject' : 'Cancel'} ${CH_SHORT[reasonFor.order.channel]} #${reasonFor.order.displayId}`}
          note={reasonFor.action === 'cancel' ? 'Uber Eats is told the reason and handles the customer refund.' : 'The reason is sent to the platform using its own matching code.'}
          onClose={() => setReasonFor(null)}
          onPick={(code, details) => { const r = reasonFor; setReasonFor(null); run(r.order, r.action, { reasonCode: code, reason: details }); }}
        />
      )}

      {/* ---------- KPI strip ---------- */}
      <section className="cc-kpis">
        <div className="cc-kpi big"><div className="lbl">Total sales today</div><div className="val">{money(k.combinedSales)}</div><div className="sub">delivery + in-store (Clover)</div></div>
        <div className="cc-kpi"><div className="lbl">Delivery sales</div><div className="val">{money(k.deliverySales)}</div><div className={`sub ${diff >= 0 ? 'up' : 'down'}`}>{diff >= 0 ? '▲' : '▼'} {money(Math.abs(diff))} vs yesterday same time</div></div>
        <div className="cc-kpi"><div className="lbl">Delivery orders</div><div className="val">{k.deliveryOrders}</div><div className="sub">avg ticket {money(k.avgTicket)}{k.cancelled ? ` · ${k.cancelled} cancelled` : ''}</div></div>
        <div className="cc-kpi"><div className="lbl">In-store (Clover)</div><div className="val">{data.clover.configured ? money(k.inStore) : '—'}</div><div className="sub">{data.clover.configured ? `${k.inStorePayments} payments` : 'Clover not connected'}</div></div>
        <div className={`cc-kpi ${k.newOrders ? 'alert' : ''}`}><div className="lbl">Open orders</div><div className="val">{k.openOrders}</div><div className="sub">{k.newOrders ? `${k.newOrders} waiting to accept` : 'none waiting'}</div></div>
        <div className={`cc-kpi ${data.alertCounts.critical ? 'alert' : ''}`}><div className="lbl">Needs attention</div><div className="val">{data.alertCounts.critical + data.alertCounts.warning}</div><div className="sub">{data.alertCounts.critical} critical · {data.alertCounts.warning} warnings</div></div>
        <div className="cc-kpi"><div className="lbl">Stores online</div><div className="val">{k.storesOnline}<span className="of">/{k.storesMapped}</span></div><div className="sub">{k.storesPaused} paused · {k.storesDeactivated} deactivated</div></div>
      </section>

      {/* ---------- Queue + Alerts ---------- */}
      <section className="cc-mid">
        <div className="cc-panel">
          <div className="cc-panel-head"><h2>Orders to handle <span className="count">{data.queue.length}</span></h2><Link className="small" href="/dashboard/food-hub/board">Full order board →</Link></div>
          <div className="cc-scroll">
            {data.queue.length === 0 && <div className="cc-empty">No open orders. New orders appear here instantly, go to Clover automatically, and are accepted on the platform.</div>}
            {data.queue.map((o) => {
              const cd = o.deadlineAt ? countdown(o.deadlineAt, now) : null;
              return (
                <div key={o.id} className={`cc-order st-${o.status} ${o.posError && !o.posOrderId ? 'pos-fail' : ''} ${o.waitingScheduled ? 'is-scheduled' : ''}`}>
                  <div className="cc-order-top">
                    <span className={`mk mk-${o.channel}`}>{CH_SHORT[o.channel]}</span>
                    <Link href={`/dashboard/food-hub/orders/${o.id}`}><strong>#{o.displayId}</strong></Link>
                    <span className="small">{o.brandName ?? 'Unmapped store'} · {shortLoc(o.locationCode, locName)} · {o.fulfillment}</span>
                    <span className="cc-grow" />
                    {cd && <span className={`cc-cd ${cd.cls}`}>{cd.text}</span>}
                    {o.waitingScheduled && o.scheduledFor && <span className="cc-sched" title="Scheduled order — the kitchen ticket prints at the fire time">⏰ for {hhmm(o.scheduledFor)}{o.fireAt ? ` · kitchen ${hhmm(o.fireAt)}` : ''}</span>}
                    {!o.waitingScheduled && o.status === 'accepted' && o.readyTarget && <span className="small" title="Prep time sent to the platform">ready by {hhmm(o.readyTarget)}</span>}
                    {o.courier && <span className={`cc-courier c-${o.courier.status}`} title={[o.courier.name, o.courier.vehicle, o.courier.etaAt ? `ETA ${hhmm(o.courier.etaAt)}` : ''].filter(Boolean).join(' · ')}>🛵 {COURIER[o.courier.status] ?? o.courier.status}{o.courier.name ? ` · ${o.courier.name}` : ''}{o.courier.etaAt && ['assigned', 'arriving'].includes(o.courier.status) ? ` · ${hhmm(o.courier.etaAt)}` : ''}</span>}
                    <span className={`cc-status s-${o.status}`}>{o.status === 'accepted' ? 'in kitchen' : (STATUS_LABEL[o.status] ?? o.status).toLowerCase()}</span>
                    <strong>{money(o.total)}</strong>
                  </div>
                  <div className="cc-lines">
                    {o.lines.map((l, i) => <span key={i}>{l.quantity}× {l.name}{l.modifiers.length ? <em> ({l.modifiers.join(', ')})</em> : null}</span>)}
                    {o.moreLines > 0 && <span className="small">+{o.moreLines} more</span>}
                    {o.notes && <span className="cc-note">“{o.notes}”</span>}
                  </div>
                  <div className="cc-order-foot">
                    {o.posOrderId ? <span className="badge badge-green" title={o.posPaid ? 'Recorded as paid in Clover with the platform tender' : 'In Clover'}>In Clover{o.posPaid ? ' · paid' : ''}</span> : o.posError ? <span className="badge badge-red" title={o.posError}>Clover failed</span> : <span className="badge badge-yellow">Clover pending</span>}
                    {o.channelError && <span className="badge badge-yellow" title={o.channelError}>Platform not updated</span>}
                    <span className="small">{sinceLabel(o.createdAt, now)}{o.customerName ? ` · ${o.customerName}` : ''}</span>
                    <span className="cc-grow" />
                    {can('orders:act') && o.actions.includes('accept') && <button className="btn-sm btn-ok" disabled={!!busy} onClick={() => act(o, 'accept')}>Accept</button>}
                    {can('orders:act') && o.actions.includes('deny') && <button className="btn-sm btn-danger" disabled={!!busy} onClick={() => act(o, 'deny')}>{o.channel === 'skip' ? 'To Skip tablet' : 'Reject'}</button>}
                    {can('orders:act') && o.actions.includes('ready') && <button className="btn-sm" disabled={!!busy} onClick={() => act(o, 'ready')}>Ready</button>}
                    {can('orders:act') && o.actions.includes('dispatch') && <button className="btn-sm" disabled={!!busy} onClick={() => act(o, 'dispatch')}>Courier picked up</button>}
                    {can('orders:act') && o.actions.includes('complete') && <button className="btn-sm btn-light" disabled={!!busy} onClick={() => act(o, 'complete')}>Done</button>}
                    {can('orders:act') && o.actions.includes('retry_pos') && <button className="btn-sm btn-light" disabled={!!busy} onClick={() => act(o, 'retry_pos')}>Send to Clover</button>}
                    {can('orders:act') && o.actions.includes('print') && <button className="btn-sm btn-light" disabled={!!busy} onClick={() => act(o, 'print')} title="Print the Clover kitchen ticket again">Reprint</button>}
                    {can('orders:act') && o.actions.includes('cancel') && <button className="btn-sm btn-light" disabled={!!busy} onClick={() => act(o, 'cancel')}>Cancel…</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cc-panel">
          <div className="cc-panel-head"><h2>Alerts <span className="count">{data.alerts.length}</span></h2><span className="small">{data.alertCounts.critical} critical · {data.alertCounts.warning} warning · {data.alertCounts.info} info</span></div>
          <div className="cc-scroll">
            {data.alerts.length === 0 && <div className="cc-empty">All clear.</div>}
            {data.alerts.map((a) => (
              <div key={a.id} className={`cc-alert ${a.severity}`}>
                <div className="cc-alert-title"><span className="dot" />{a.href ? <Link href={a.href}>{a.title}</Link> : a.title}</div>
                {a.detail && <div className="small">{a.detail}</div>}
                {a.at && <div className="small cc-faint">{sinceLabel(a.at, now)}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Channels ---------- */}
      <section className="cc-channels">
        {data.channels.map((c) => (
          <div key={c.channel} className={`cc-ch ch-${c.channel}`}>
            <div className="cc-ch-head">
              <span className={`mk mk-${c.channel}`}>{c.label}</span>
              <span className={`cc-conn ${c.canSend || (c.channel === 'tgtg' && c.configured) ? 'live' : c.configured ? 'ready' : 'none'}`} title={c.note}>{c.channel === 'tgtg' ? (c.configured ? 'Inbound only' : 'Not connected') : c.canSend ? 'Live' : c.configured ? 'Ready (live off)' : 'Not connected'}</span>
            </div>
            <div className="cc-ch-val">{money(c.sales)}</div>
            <div className="small">{c.orders} orders · {c.open} open · {c.storesOnline}/{c.storesMapped} stores online</div>
            <div className="small cc-faint">last order {sinceLabel(c.lastOrderAt, now)}</div>
          </div>
        ))}
        <div className="cc-ch ch-clover">
          <div className="cc-ch-head"><span className="mk mk-other" style={{ background: '#1f8a3b' }}>Clover POS</span><span className={`cc-conn ${data.clover.configured ? 'live' : 'none'}`}>{data.clover.configured ? 'Connected' : 'Not connected'}</span></div>
          <div className="cc-ch-val">{data.clover.configured ? money(k.inStore) : '—'}</div>
          <div className="small">{data.clover.merchants.length ? data.clover.merchants.map((m) => `${m.locationCodes.map((l) => shortLoc(l, locName)).join('/') || m.merchantId}: ${m.ok ? money(m.net) : 'error'}`).join(' · ') : 'in-store sales appear after the first sync'}</div>
        </div>
      </section>

      {/* ---------- Matrix + charts ---------- */}
      <section className="cc-bottom">
        <div className="cc-panel">
          <div className="cc-panel-head">
            <h2>Every brand · every location · every app <span className="count">{data.matrixSummary.complete}/{data.matrixSummary.rows} complete</span></h2>
            <div className="fh-row">
              <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)}>
                <option value="">All locations</option>
                {[...new Set(data.matrix.map((r) => r.locationCode))].map((code) => <option key={code} value={code}>{shortLoc(code, locName)}</option>)}
              </select>
              <label className="small fh-row"><input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} /> Issues only</label>
            </div>
          </div>
          {picked && (
            <div className="cc-pick">
              <strong>{picked.brandName} · {shortLoc(picked.locationCode, locName)} · {CH_SHORT[picked.channel]}</strong>
              <span className="small">{STATE_HINT[picked.cell.state]}{picked.cell.detail ? ` — ${picked.cell.detail}` : ''}</span>
              <span className="cc-grow" />
              <button className="btn-sm btn-light" disabled={busy === 'store'} onClick={() => storeAction(false, 30)}>Pause 30 min</button>
              <button className="btn-sm btn-light" disabled={busy === 'store'} onClick={() => storeAction(false)}>Pause</button>
              <button className="btn-sm btn-ok" disabled={busy === 'store'} onClick={() => storeAction(true)}>Resume</button>
              <button className="btn-sm btn-light" onClick={() => setPicked(null)}>×</button>
            </div>
          )}
          <div className="cc-scroll cc-matrix-wrap">
            <table className="cc-matrix">
              <thead><tr><th>Brand</th><th>Location</th>{CH.map((c) => <th key={c}>{CH_SHORT[c]}{c !== 'tgtg' ? ' *' : ''}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.brandName}|${r.locationCode}`} className={r.issues ? 'has-issues' : ''}>
                    <td className="cc-brand">{r.brandName}</td>
                    <td className="small">{shortLoc(r.locationCode, locName)}</td>
                    {CH.map((c) => {
                      const cell = r.cells[c];
                      const required = c !== 'tgtg';
                      const title = `${STATE_HINT[cell.state]}${cell.source === 'screenshot' ? ' (from your screenshot — not verified live)' : ''}${cell.detail ? `\n${cell.detail}` : ''}${cell.until ? `\nuntil ${new Date(cell.until).toLocaleString('fr-CA', { timeZone: data.timezone })}` : ''}${cell.checkedAt ? `\nchecked ${sinceLabel(cell.checkedAt, now)}` : ''}`;
                      const chip = <span className={`cc-cell s-${cell.state} ${cell.source === 'screenshot' ? 'snap' : ''} ${!required && cell.state === 'missing' ? 'optional' : ''}`} title={title}>{STATE_LABEL[cell.state]}{cell.stores > 1 ? <sup>{cell.stores}</sup> : null}</span>;
                      return (
                        <td key={c}>
                          {cell.source === 'live'
                            ? <button className="cc-cell-btn" onClick={() => setPicked({ brandName: r.brandName, locationCode: r.locationCode, channel: c, cell })}>{chip}</button>
                            : cell.state === 'missing' && required ? <Link href="/dashboard/food-hub/stores">{chip}</Link> : chip}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="small">Nothing to show with these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="cc-legend small">
            {(['online', 'closed', 'paused', 'deactivated', 'not_synced', 'missing'] as CellState[]).map((s) => <span key={s}><span className={`cc-cell s-${s}`}>{STATE_LABEL[s]}</span> {STATE_HINT[s].split(' — ')[0]}</span>)}
            <span><span className="cc-cell s-closed snap">Closed</span> faded = from screenshot</span>
            <span>* required service</span>
          </div>
        </div>

        <div className="cc-side">
          {data.kitchen?.length > 0 && (
            <div className="cc-panel">
              <div className="cc-panel-head"><h2>Kitchen</h2><Link className="small" href="/dashboard/food-hub/stores">Prep times →</Link></div>
              {data.kitchen.map((k) => (
                <div key={k.locationCode} className={`cc-kitchen ${k.isBusy ? 'busy' : ''}`}>
                  <span className="name"><strong>{shortLoc(k.locationCode, locName)}</strong> <span className="small">prep {k.minutes} min</span></span>
                  {can('stores:toggle')
                    ? <button className={`btn-sm ${k.isBusy ? 'btn-danger' : 'btn-light'}`} disabled={busy === 'kitchen' + k.locationCode} onClick={() => setBusyMode(k, !k.isBusy)} aria-pressed={k.isBusy}>{k.isBusy ? 'Busy — turn off' : 'Busy mode'}</button>
                    : <span className="small">{k.isBusy ? 'Busy' : 'Normal'}</span>}
                </div>
              ))}
              <div className="small cc-faint">Busy mode adds prep time to new orders: DoorDash receives it with the confirmation, and every ticket shows the ready-by time. For Uber Eats and Skip, also raise prep time in their own store settings when busy for long.</div>
            </div>
          )}
          <div className="cc-panel">
            <div className="cc-panel-head"><h2>Sales by hour</h2><span className="small"><span className="cc-key today" /> today <span className="cc-key yday" /> yesterday</span></div>
            <svg className="cc-hours" viewBox="0 0 480 122" preserveAspectRatio="none" role="img" aria-label="Delivery sales by hour">
              {data.byHour.map((h) => {
                const x = h.hour * 20;
                const ty = 120 - (h.sales / maxHour) * 110;
                const yy = 120 - (h.yesterday / maxHour) * 110;
                return (
                  <g key={h.hour}>
                    <rect x={x + 3} y={yy} width={14} height={120 - yy} className="yday"><title>{`${h.hour}h yesterday ${money(h.yesterday)}`}</title></rect>
                    <rect x={x + 6} y={ty} width={8} height={120 - ty} className={h.hour === curHour ? 'today now' : 'today'}><title>{`${h.hour}h today ${money(h.sales)} · ${h.orders} orders`}</title></rect>
                  </g>
                );
              })}
            </svg>
            <div className="cc-hours-axis">{[0, 3, 6, 9, 12, 15, 18, 21].map((h) => <span key={h} style={{ left: `${((h + 0.5) / 24) * 100}%` }}>{h}h</span>)}</div>
          </div>
          <div className="cc-panel">
            <div className="cc-panel-head"><h2>Top brands today</h2></div>
            {data.byBrand.length === 0 && <div className="cc-empty">No delivery sales yet today.</div>}
            {data.byBrand.slice(0, 8).map((b) => (
              <div key={b.brandName} className="cc-bar">
                <span className="name">{b.brandName}</span>
                <span className="track"><span style={{ width: `${(b.sales / maxBrand) * 100}%` }} /></span>
                <span className="amt">{money(b.sales)} <span className="small">({b.orders})</span></span>
              </div>
            ))}
          </div>
          <div className="cc-panel">
            <div className="cc-panel-head"><h2>By location</h2></div>
            <table className="cc-loc">
              <tbody>
                {data.byLocation.map((l) => (
                  <tr key={l.locationCode}>
                    <td><strong>{LOC_SHORT[l.locationCode] ?? l.name}</strong><div className="small">{l.address}</div></td>
                    <td className="r">{money(l.sales)}<div className="small">{l.orders} delivery</div></td>
                    <td className="r">{data.clover.configured ? money(l.inStore) : '—'}<div className="small">in-store</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <footer className="small cc-faint cc-foot">
        Refreshes every 5 s · platform status + Clover sync every 2 min while this screen is open · updated {sinceLabel(data.generatedAt, now)}
        {!data.dashboardProtected && ' · no dashboard password set (required before going live)'}
      </footer>
    </div>
  );
}
