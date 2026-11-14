'use client';

import { useEffect, useState } from 'react';
import { api, downloadCsv, MK_LABEL, MultiPick, presetRange, RANGE_LABELS, useCatalog, type RangePreset } from '../ui';

type Entry = { id?: string; at: string; actor: string; source: string; kind: string; action: string; status: 'success' | 'failed' | 'queued' | 'info'; summary: string; channel?: string | null; brandName?: string | null; locationCode?: string | null };

const KINDS: Array<[string, string]> = [
  ['order', 'Orders'], ['store_status', 'Store open / pause'], ['item_availability', 'Items 86 / back'], ['menu_publish', 'Menu publish'],
  ['hours', 'Hours'], ['settings', 'Settings'], ['users', 'Users'], ['login', 'Sign-ins'],
];
const SOURCE: Record<string, string> = { dashboard: 'Dashboard', automation: 'Automatic', platform: 'Platform', schedule: 'Scheduled', api: 'API', system: 'System' };
const STATUS_CLS: Record<string, string> = { success: 'badge-green', failed: 'badge-red', queued: 'badge-yellow', info: 'badge-blue' };

// Activity log (Atlas "Store Action Report"): who did what, when, where and whether it worked.
export default function ActivityPage() {
  const { activeLocations, locName } = useCatalog();
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [range, setRange] = useState(presetRange('7d'));
  const [kinds, setKinds] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [failedOnly, setFailedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const q = new URLSearchParams({ from: range.from, to: range.to, limit: '2000' });
    if (kinds.length) q.set('kinds', kinds.join(','));
    if (locations.length) q.set('locations', locations.join(','));
    if (search.trim()) q.set('q', search.trim());
    const t = setTimeout(() => {
      api<{ entries: Entry[] }>(`/api/food-hub/activity?${q}`).then((d) => alive && (setEntries(d.entries), setError(''))).catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [range, kinds, locations, search]);

  const shown = failedOnly ? entries.filter((e) => e.status === 'failed') : entries;

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Activity log</h1>
          <div className="small">Every pause, resume, 86, menu publish, hours change, order action and sign-in — by whom, from where, and whether the platform accepted it.</div>
        </div>
        <div className="fh-row">
          <button className="btn-light" onClick={() => downloadCsv('takatak-activity', ['When', 'Who', 'From', 'Type', 'Action', 'Result', 'Platform', 'Brand', 'Location', 'Details'],
            shown.map((e) => [new Date(e.at).toLocaleString('fr-CA'), e.actor, SOURCE[e.source] ?? e.source, e.kind, e.action, e.status, e.channel ? MK_LABEL[e.channel] ?? e.channel : '', e.brandName ?? '', e.locationCode ? locName(e.locationCode) : '', e.summary]))}>Export CSV</button>
        </div>
      </div>
      <div className="fh-filters">
        <select value={preset} onChange={(e) => { const p = e.target.value as RangePreset; setPreset(p); if (p !== 'custom') setRange(presetRange(p)); }} aria-label="Date range">
          {(Object.keys(RANGE_LABELS) as RangePreset[]).map((k) => <option key={k} value={k}>{RANGE_LABELS[k]}</option>)}
        </select>
        {preset === 'custom' && <><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /> <span className="small">to</span> <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></>}
        <MultiPick label="Type" options={KINDS} value={kinds} onChange={setKinds} />
        <MultiPick label="Locations" options={activeLocations.map((l) => [l.code, l.name])} value={locations} onChange={setLocations} />
        <label className="fh-row small"><input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} /> Failed only</label>
        <input type="search" placeholder="Search who / what…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {loading && <span className="small">Loading…</span>}
      </div>
      {error && <div className="fh-banner warn">{error}</div>}
      <div className="fh-table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Type</th><th>What happened</th><th>Where</th><th>Result</th></tr></thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={e.id ?? i}>
                <td className="small">{new Date(e.at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                <td>{e.actor}<div className="small">{SOURCE[e.source] ?? e.source}</div></td>
                <td className="small">{KINDS.find(([k]) => k === e.kind)?.[1] ?? e.kind}</td>
                <td style={{ whiteSpace: 'normal', minWidth: 280 }}>{e.summary}</td>
                <td className="small">{[e.channel ? MK_LABEL[e.channel] ?? e.channel : null, e.brandName, e.locationCode ? locName(e.locationCode) : null].filter(Boolean).join(' · ') || '—'}</td>
                <td><span className={`badge ${STATUS_CLS[e.status] ?? 'badge-blue'}`}>{e.status}</span></td>
              </tr>
            ))}
            {!loading && shown.length === 0 && <tr><td colSpan={6} className="small">Nothing recorded for these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
