'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export const MK_LABEL: Record<string, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash', skip: 'Skip', tgtg: 'TGTG', other: 'Other' };
export const LOCATIONS = [
  { code: 'NDG_MAIN', name: 'NDG MAIN — 6280 Somerled' },
  { code: 'NDG_6284', name: 'NDG 6284 — 6284 Somerled' },
  { code: 'HOCHELAGA', name: 'HOCHELAGA — 3583 Ste-Catherine E' },
  { code: 'SAINT_LEONARD', name: 'SAINT-LÉONARD — 5837 Jean-Talon E' },
];

export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export function Marketplace({ value }: { value: string }) {
  return <span className={`mk mk-${value}`}>{MK_LABEL[value] ?? value}</span>;
}

export function money(n: number | undefined | null) {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(Number(n || 0));
}

export function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

export function ModeBanner({ mode }: { mode?: string }) {
  if (mode !== 'memory') return null;
  return (
    <div className="fh-banner warn">
      Test mode: the Food Hub database is not reachable, so data is kept in memory and lost on restart. Check the TAKATAK Supabase keys and apply the migrations (npm run db:deploy).
    </div>
  );
}

export function ResultsTable({ results }: { results: Array<{ channel: string; brandName: string; locationCode: string; channelStoreId: string; result: { status: string; message: string } }> }) {
  if (!results?.length) return null;
  return (
    <table className="fh-result">
      <thead><tr><th>Channel</th><th>Store</th><th>Result</th></tr></thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={i}>
            <td>{r.channel}</td>
            <td>{r.brandName} · {r.locationCode}<br /><span className="small fh-mono">{r.channelStoreId}</span></td>
            <td><StatusBadge status={r.result.status} /> <span className="small">{r.result.message}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const cls = status === 'done' || status === 'queued' ? 'badge-green' : status === 'skipped' ? 'badge-blue' : status === 'blocked' ? 'badge-yellow' : 'badge-red';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="fh-head" style={{ marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>{right}</div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared hooks & widgets (RC8)
// ---------------------------------------------------------------------------

export type CatalogLocation = { code: string; name: string; address: string; city?: string; active: boolean };
export type CatalogBrand = { name: string; active: boolean };

/** Brands & locations from Food Hub (seed + added). Falls back to the built-in list while loading. */
export function useCatalog() {
  const [catalog, setCatalog] = useState<{ locations: CatalogLocation[]; brands: CatalogBrand[] }>({ locations: LOCATIONS.map((l) => ({ code: l.code, name: l.name, address: '', active: true })), brands: [] });
  const reload = useCallback(() => api<{ locations: CatalogLocation[]; brands: CatalogBrand[] }>('/api/food-hub/catalog').then(setCatalog).catch(() => undefined), []);
  useEffect(() => { reload(); }, [reload]);
  const active = useMemo(() => catalog.locations.filter((l) => l.active), [catalog]);
  const locName = useCallback((code?: string | null) => (code ? catalog.locations.find((l) => l.code === code)?.name ?? code : '—'), [catalog]);
  return { ...catalog, activeLocations: active, locName, reload };
}

export type Me = { username: string; name: string; role: string; locations: string[]; permissions: string[] };
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<{ user: Me }>('/api/food-hub/auth/me').then((d) => setMe(d.user)).catch(() => undefined); }, []);
  const can = useCallback((perm: string) => !me || me.permissions.includes(perm), [me]);
  return { me, can };
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fh-modal-back" onClick={onClose}>
      <div className={`fh-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="fh-head" style={{ marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2><button className="btn-sm btn-light" onClick={onClose} aria-label="Close">×</button></div>
        {children}
      </div>
    </div>
  );
}

export const REASONS: Array<[string, string]> = [
  ['out_of_stock', 'Item out of stock'],
  ['too_busy', 'Kitchen too busy'],
  ['store_closed', 'Store / kitchen closed'],
  ['pos_issue', 'POS / Clover problem'],
  ['customer_request', 'Customer asked to cancel'],
  ['other', 'Other'],
];

/** Reject / cancel with a standard reason (mapped to each platform's own codes on the server). */
export function ReasonDialog({ title, note, onPick, onClose }: { title: string; note?: string; onPick: (code: string, details: string) => void; onClose: () => void }) {
  const [code, setCode] = useState('out_of_stock');
  const [details, setDetails] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      {note && <p className="small">{note}</p>}
      <div className="fh-reasons">
        {REASONS.map(([k, label]) => (
          <label key={k} className={`fh-reason ${code === k ? 'on' : ''}`}><input type="radio" name="reason" checked={code === k} onChange={() => setCode(k)} /> {label}</label>
        ))}
      </div>
      <input style={{ width: '100%', marginTop: 8 }} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <div className="fh-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn-light" onClick={onClose}>Back</button>
        <button className="btn-danger" onClick={() => onPick(code, details)}>Confirm</button>
      </div>
    </Modal>
  );
}

// ---------- notifications (per device, like Prime's notification settings) ----------

export type NotifySettings = { sound: boolean; tone: 'chime' | 'bell' | 'beep'; repeat: boolean; desktop: boolean; cancellations: boolean; critical: boolean; keepAwake: boolean };
const NOTIFY_KEY = 'takatak.notify.v1';
const NOTIFY_DEFAULT: NotifySettings = { sound: true, tone: 'chime', repeat: true, desktop: false, cancellations: true, critical: true, keepAwake: false };

function readNotify(): NotifySettings {
  try { return { ...NOTIFY_DEFAULT, ...JSON.parse(window.localStorage.getItem(NOTIFY_KEY) || '{}') }; } catch { return NOTIFY_DEFAULT; }
}

export function playTone(tone: NotifySettings['tone'], urgent = false) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const notes = tone === 'bell' ? [988, 1319] : tone === 'beep' ? [880] : [784, 1047, 1319];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = tone === 'beep' ? 'square' : 'sine';
      osc.frequency.value = urgent ? f * 0.75 : f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.32);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18); osc.stop(ctx.currentTime + i * 0.18 + 0.34);
    });
  } catch { /* sound is optional */ }
}

export function useNotify() {
  const [settings, setSettings] = useState<NotifySettings>(NOTIFY_DEFAULT);
  useEffect(() => { setSettings(readNotify()); }, []);
  const update = useCallback((patch: Partial<NotifySettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try { window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
    if (patch.desktop && typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => undefined);
    if (patch.keepAwake) setTimeout(() => window.dispatchEvent(new Event('takatak:keepawake')), 0);
  }, []);
  const alert = useCallback((title: string, body: string, kind: 'order' | 'cancel' | 'critical' = 'order') => {
    if (kind === 'cancel' && !settings.cancellations) return;
    if (kind === 'critical' && !settings.critical) return;
    if (settings.sound) playTone(settings.tone, kind !== 'order');
    if (settings.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      try { new Notification(title, { body, tag: `${kind}:${title}` }); } catch { /* ignore */ }
    }
  }, [settings]);
  // Stable identity for callers that keep it in a ref / effect dependency list.
  return useMemo(() => ({ settings, update, alert }), [settings, update, alert]);
}

export function NotifyPanel({ settings, update, onClose }: { settings: NotifySettings; update: (p: Partial<NotifySettings>) => void; onClose: () => void }) {
  return (
    <Modal title="Alerts on this screen" onClose={onClose}>
      <div className="fh-col-form">
        <label className="fh-row"><input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} /> Sound for new orders</label>
        <label className="fh-row small">Tone <select value={settings.tone} onChange={(e) => update({ tone: e.target.value as NotifySettings['tone'] })}><option value="chime">Chime</option><option value="bell">Bell</option><option value="beep">Beep</option></select>
          <button className="btn-sm btn-light" onClick={() => playTone(settings.tone)}>Test</button></label>
        <label className="fh-row"><input type="checkbox" checked={settings.repeat} onChange={(e) => update({ repeat: e.target.checked })} /> Repeat every 20 s until every new order is handled</label>
        <label className="fh-row"><input type="checkbox" checked={settings.cancellations} onChange={(e) => update({ cancellations: e.target.checked })} /> Alert when a platform cancels an order</label>
        <label className="fh-row"><input type="checkbox" checked={settings.critical} onChange={(e) => update({ critical: e.target.checked })} /> Alert on critical problems (Clover down, store deactivated)</label>
        <label className="fh-row"><input type="checkbox" checked={settings.desktop} onChange={(e) => update({ desktop: e.target.checked })} /> Desktop notifications when this tab is in the background</label>
        <label className="fh-row"><input type="checkbox" checked={settings.keepAwake} onChange={(e) => update({ keepAwake: e.target.checked })} /> Keep this screen on (kitchen tablet / wall screen)</label>
        <p className="small">Install as an app: on iPad, Share → <em>Add to Home Screen</em>; on Android / Chrome, menu → <em>Install app</em>.</p>
        <p className="small">These settings are saved on this device only — set them on each screen (kitchen tablet, office PC).</p>
      </div>
    </Modal>
  );
}

// ---------- filters (one row, above everything they scope) ----------

export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last_month' | 'custom';
export const RANGE_LABELS: Record<RangePreset, string> = { today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', last_month: 'Last month', custom: 'Custom' };

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function presetRange(p: RangePreset, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const day = (offset: number) => { const d = new Date(now); d.setDate(d.getDate() + offset); return ymd(d); };
  switch (p) {
    case 'today': return { from: day(0), to: day(0) };
    case 'yesterday': return { from: day(-1), to: day(-1) };
    case '7d': return { from: day(-6), to: day(0) };
    case '30d': return { from: day(-29), to: day(0) };
    case 'month': return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(0) };
    case 'last_month': return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)) };
    default: return custom ?? { from: day(0), to: day(0) };
  }
}

export type Filters = { preset: RangePreset; from: string; to: string; locations: string[]; channels: string[]; brands: string[] };

/** Filters live in the URL so a filtered view can be shared as a link (Atlas "share link"). */
export function useFilters(defaultPreset: RangePreset = '7d') {
  const [f, setF] = useState<Filters>(() => ({ preset: defaultPreset, ...presetRange(defaultPreset), locations: [], channels: [], brands: [] }));
  const loaded = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const preset = (q.get('range') as RangePreset) || defaultPreset;
    const custom = q.get('from') && q.get('to') ? { from: q.get('from')!, to: q.get('to')! } : undefined;
    const split = (k: string) => (q.get(k) || '').split(',').filter(Boolean);
    setF({ preset, ...presetRange(preset, custom), locations: split('locations'), channels: split('channels'), brands: split('brands') });
    loaded.current = true;
  }, [defaultPreset]);
  const set = useCallback((patch: Partial<Filters>) => {
    setF((cur) => {
      const next = { ...cur, ...patch };
      if (patch.preset && patch.preset !== 'custom') Object.assign(next, presetRange(patch.preset));
      const q = new URLSearchParams();
      q.set('range', next.preset);
      if (next.preset === 'custom') { q.set('from', next.from); q.set('to', next.to); }
      if (next.locations.length) q.set('locations', next.locations.join(','));
      if (next.channels.length) q.set('channels', next.channels.join(','));
      if (next.brands.length) q.set('brands', next.brands.join(','));
      window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
      return next;
    });
  }, []);
  const query = useMemo(() => {
    const q = new URLSearchParams({ from: f.from, to: f.to });
    if (f.locations.length) q.set('locations', f.locations.join(','));
    if (f.channels.length) q.set('channels', f.channels.join(','));
    if (f.brands.length) q.set('brands', f.brands.join(','));
    return q.toString();
  }, [f]);
  return { filters: f, set, query, ready: loaded };
}

export function MultiPick({ label, options, value, onChange }: { label: string; options: Array<[string, string]>; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <details className="fh-pick">
      <summary>{label}: {value.length === 0 ? 'All' : value.length === 1 ? options.find(([k]) => k === value[0])?.[1] ?? value[0] : `${value.length} selected`}</summary>
      <div className="fh-pick-menu">
        <button className="btn-sm btn-light" onClick={() => onChange([])}>All</button>
        {options.map(([k, l]) => (
          <label key={k} className="fh-row"><input type="checkbox" checked={value.includes(k)} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} /> {l}</label>
        ))}
      </div>
    </details>
  );
}

export const CHANNEL_OPTIONS: Array<[string, string]> = [['uber_eats', 'Uber Eats'], ['doordash', 'DoorDash'], ['skip', 'SkipTheDishes'], ['tgtg', 'Too Good To Go']];

export function FilterBar({ filters, set, brands, locations, extra }: { filters: Filters; set: (p: Partial<Filters>) => void; brands: string[]; locations: CatalogLocation[]; extra?: ReactNode }) {
  return (
    <div className="fh-filters">
      <select value={filters.preset} onChange={(e) => set({ preset: e.target.value as RangePreset })} aria-label="Date range">
        {(Object.keys(RANGE_LABELS) as RangePreset[]).map((k) => <option key={k} value={k}>{RANGE_LABELS[k]}</option>)}
      </select>
      {filters.preset === 'custom' && (
        <>
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value, preset: 'custom' })} aria-label="From" />
          <span className="small">to</span>
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value, preset: 'custom' })} aria-label="To" />
        </>
      )}
      <MultiPick label="Locations" options={locations.map((l) => [l.code, l.name])} value={filters.locations} onChange={(v) => set({ locations: v })} />
      <MultiPick label="Platforms" options={CHANNEL_OPTIONS} value={filters.channels} onChange={(v) => set({ channels: v })} />
      <MultiPick label="Brands" options={brands.map((b) => [b, b])} value={filters.brands} onChange={(v) => set({ brands: v })} />
      {extra}
    </div>
  );
}

/** Client-side CSV download for any table on screen (UTF-8 BOM for Excel). */
export function downloadCsv(filename: string, columns: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) && typeof v === 'string' ? `'${s}` : s).replace(/"/g, '""')}"` : s; };
  const blob = new Blob(['﻿' + [columns, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function fmtTime(iso?: string | null, withDate = false) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-CA', withDate ? { dateStyle: 'short', timeStyle: 'short' } : { hour: '2-digit', minute: '2-digit' });
}

export const STATUS_LABEL: Record<string, string> = { new: 'New', accepted: 'Preparing', ready: 'Ready', dispatched: 'Picked up', completed: 'Completed', cancelled: 'Cancelled', failed: 'On Skip tablet' };

// ---------- weekly hours editor (store hours, brand overrides, category schedules) ----------

export type Slot = { open: string; close: string };
export type Week = Record<string, Slot[]>;
export const WEEK_DAYS: Array<[string, string]> = [['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'], ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun']];
export const emptyWeekUi = (): Week => Object.fromEntries(WEEK_DAYS.map(([d]) => [d, []]));
export const fullWeekUi = (open = '11:00', close = '23:00'): Week => Object.fromEntries(WEEK_DAYS.map(([d]) => [d, [{ open, close }]]));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function weekProblems(week: Week): string[] {
  const out: string[] = [];
  for (const [d, label] of WEEK_DAYS) for (const s of week[d] ?? []) {
    if (!TIME_RE.test(s.open) || !TIME_RE.test(s.close)) out.push(`${label}: use HH:MM times`);
    else if (s.open === s.close) out.push(`${label}: ${s.open}–${s.close} is empty`);
  }
  return out;
}

/** One row per day, several open/close slots per day. A slot that closes after midnight (18:00–02:00) is allowed. */
export function WeekEditor({ value, onChange, disabled }: { value: Week; onChange: (w: Week) => void; disabled?: boolean }) {
  const setDay = (day: string, slots: Slot[]) => onChange({ ...value, [day]: slots });
  const copyToAll = (day: string) => onChange(Object.fromEntries(WEEK_DAYS.map(([d]) => [d, (value[day] ?? []).map((s) => ({ ...s }))])));
  return (
    <div className="fh-week">
      {WEEK_DAYS.map(([day, label]) => {
        const slots = value[day] ?? [];
        return (
          <div key={day} className="fh-week-row">
            <span className="fh-week-day">{label}</span>
            <div className="fh-row" style={{ flex: 1 }}>
              {slots.length === 0 && <span className="fh-chip st-cancelled">Closed</span>}
              {slots.map((s, i) => (
                <span key={i} className="fh-slot">
                  <input type="time" value={s.open} disabled={disabled} aria-label={`${label} opens`} onChange={(e) => setDay(day, slots.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
                  –
                  <input type="time" value={s.close} disabled={disabled} aria-label={`${label} closes`} onChange={(e) => setDay(day, slots.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
                  {s.close <= s.open && s.close !== s.open && <span className="small">(+1 day)</span>}
                  {!disabled && <button className="btn-sm btn-light" aria-label="Remove slot" onClick={() => setDay(day, slots.filter((_, j) => j !== i))}>×</button>}
                </span>
              ))}
            </div>
            {!disabled && (
              <span className="fh-row">
                <button className="btn-sm btn-light" onClick={() => setDay(day, [...slots, slots.length ? { open: '17:00', close: '22:00' } : { open: '11:00', close: '23:00' }])}>+ slot</button>
                <button className="btn-sm btn-light" onClick={() => setDay(day, [{ open: '00:00', close: '23:59' }])} title="Open all day">24 h</button>
                <button className="btn-sm btn-light" onClick={() => copyToAll(day)} title="Copy this day to every day">Copy to all</button>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
