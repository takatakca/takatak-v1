'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, LOCATIONS, ModeBanner, ResultsTable, Section, useCatalog, useMe } from '../ui';

type Store = {
  id: string; channel: string; channelStoreId: string; brandName: string; locationCode: string; cloverMerchantId?: string | null; autoAccept: boolean; online: boolean;
  pausedUntil?: string | null; lastStatusSource?: string | null;
  meta?: { platformStatus?: { state: string; detail?: string; source?: string; checkedAt?: string; error?: string } };
};
const STATE_BADGE: Record<string, [string, string]> = {
  online: ['Online', 'badge-green'], closed: ['Closed (hours)', 'badge-blue'], paused: ['Paused', 'badge-yellow'], deactivated: ['Deactivated', 'badge-red'], unknown: ['Unknown', 'badge-yellow'],
};

const CHANNELS: Array<[string, string, string]> = [
  ['uber_eats', 'Uber Eats', 'Uber store UUID (use “Discover Uber stores”)'],
  ['doordash', 'DoorDash', 'merchant_supplied_id agreed with DoorDash'],
  ['skip', 'SkipTheDishes', 'your POS location id registered with JET Connect (posLocationId)'],
  ['tgtg', 'Too Good To Go', 'TGTG store id'],
];
const PAUSES: Array<[string, number]> = [['15 min', 15], ['30 min', 30], ['1 hour', 60], ['Until resumed', 0]];
const blank = { channel: 'uber_eats', channelStoreId: '', brandName: '', locationCode: LOCATIONS[0].code, cloverMerchantId: '', autoAccept: true };

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [mode, setMode] = useState<string>();
  const [form, setForm] = useState({ ...blank });
  const [pause, setPause] = useState(30);
  const [results, setResults] = useState<any[]>([]);
  const [discovered, setDiscovered] = useState<Array<{ id: string; name: string; address?: string }>>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [connectId, setConnectId] = useState('');
  const [picks, setPicks] = useState<Array<{ storeId: string; name: string; address?: string; brandName: string; locationCode: string; include: boolean }>>([]);
  const [connectDone, setConnectDone] = useState<Array<{ storeId: string; ok: boolean; message: string }>>([]);
  const [prep, setPrep] = useState<Record<string, { normal: number; busy: number; isBusy: boolean }>>({});
  const { activeLocations } = useCatalog();
  const { can } = useMe();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get('uber_error');
    if (err) setMsg(err);
    const id = q.get('uber_connect');
    if (!id) return;
    setConnectId(id);
    api<{ stores: Array<{ id: string; name: string; address?: string; suggestedBrand?: string; suggestedLocation?: string }>; error: string | null; active: boolean }>(`/api/food-hub/uber-connect/session?id=${id}`)
      .then((d) => {
        if (d.error) setMsg(d.error);
        if (!d.active) setMsg('This Uber connection was already used. Click “Connect Uber Eats stores” again to add more.');
        setPicks(d.stores.map((x) => ({ storeId: x.id, name: x.name, address: x.address, brandName: x.suggestedBrand || '', locationCode: x.suggestedLocation || '', include: Boolean(x.suggestedBrand && x.suggestedLocation) })));
      })
      .catch((e) => setMsg(e.message));
  }, []);

  const activateUber = () => run('activate', async () => {
    const chosen = picks.filter((p) => p.include);
    if (chosen.some((p) => !p.brandName || !p.locationCode)) { setMsg('Pick a brand and a location for every selected Uber store.'); return; }
    const d = await api<{ results: Array<{ storeId: string; ok: boolean; message: string }> }>('/api/food-hub/uber-connect/activate', { method: 'POST', json: { id: connectId, stores: chosen } });
    setConnectDone(d.results);
    setMsg(`${d.results.filter((r) => r.ok).length} of ${d.results.length} Uber store(s) activated and mapped.`);
    window.history.replaceState(null, '', '/dashboard/food-hub/stores');
    await load();
  });

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([api<{ stores: Store[]; mode: string }>('/api/food-hub/stores'), api<{ brands: string[] }>('/api/food-hub/menu')]);
    setStores(s.stores); setMode(s.mode); setBrands(m.brands);
    api<{ prep: Record<string, { normal: number; busy: number; isBusy: boolean }> }>('/api/food-hub/prep').then((d) => setPrep(d.prep)).catch(() => undefined);
    setForm((f) => ({ ...f, brandName: f.brandName || m.brands[0] || '' }));
  }, []);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setMsg('');
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  }

  const save = () => run('save', async () => {
    await api('/api/food-hub/stores', { method: 'POST', json: form });
    setForm({ ...blank, brandName: form.brandName, locationCode: form.locationCode, channel: form.channel });
    setMsg('Store mapping saved.');
    await load();
  });

  const setOnline = (ids: string[], online: boolean) => run('status', async () => {
    const d = await api<{ results: any[] }>('/api/food-hub/stores/status', { method: 'POST', json: { storeIds: ids, online, minutes: online ? 0 : pause } });
    setResults(d.results);
    await load();
  });

  const discover = () => run('discover', async () => {
    const d = await api<{ stores: Array<{ id: string; name: string; address?: string }> }>('/api/food-hub/stores/discover', { method: 'POST', json: { channel: 'uber_eats' } });
    setDiscovered(d.stores);
    if (!d.stores.length) setMsg('Uber returned no stores for this app yet.');
  });

  const remove = (id: string) => run('remove', async () => {
    if (!window.confirm('Remove this store mapping? Orders from it will show as unmapped.')) return;
    await api(`/api/food-hub/stores?id=${id}`, { method: 'DELETE' });
    await load();
  });

  const byLocation = activeLocations.map((l) => ({ ...l, stores: stores.filter((s) => s.locationCode === l.code) }));
  const savePrep = (code: string, patch: Partial<{ normal: number; busy: number; isBusy: boolean }>) => run('prep', async () => {
    const d = await api<{ prep: { normal: number; busy: number; isBusy: boolean } }>('/api/food-hub/prep', { method: 'POST', json: { locationCode: code, ...patch } });
    setPrep((p) => ({ ...p, [code]: d.prep }));
    setMsg('Prep time saved — applies to new orders.');
  });
  const hint = CHANNELS.find(([k]) => k === form.channel)?.[2];

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Stores</h1>
          <div className="small">Map each brand + location to its store on every channel, then pause or resume from here.</div>
        </div>
        <div className="fh-row">
          <a className="button btn-ok" href="/api/food-hub/uber-connect/start">Connect Uber Eats stores</a>
          <span className="small">Pause length</span>
          <select value={pause} onChange={(e) => setPause(Number(e.target.value))}>{PAUSES.map(([l, v]) => <option key={l} value={v}>{l}</option>)}</select>
        </div>
      </div>
      <ModeBanner mode={mode} />
      {msg && <div className="fh-banner info">{msg}</div>}
      <ResultsTable results={results} />

      {connectId && picks.length > 0 && (
        <Section title={`Uber Eats stores on your account (${picks.length})`} right={<button className="btn-ok" disabled={!!busy || !picks.some((p) => p.include)} onClick={activateUber}>{busy === 'activate' ? 'Activating…' : 'Activate & map selected'}</button>}>
          <p className="small">Brand and location are pre-filled from the Uber store name and address — check them, then activate. Orders from these stores start arriving here and in Clover.</p>
          <table>
            <thead><tr><th></th><th>Uber store</th><th>Brand</th><th>Location</th><th>Result</th></tr></thead>
            <tbody>
              {picks.map((p, i) => {
                const done = connectDone.find((r) => r.storeId === p.storeId);
                const upd = (patch: Partial<typeof p>) => setPicks((all) => all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={p.storeId}>
                    <td><input type="checkbox" checked={p.include} onChange={(e) => upd({ include: e.target.checked })} /></td>
                    <td>{p.name}<div className="small">{p.address}</div><div className="small fh-mono">{p.storeId}</div></td>
                    <td><select value={p.brandName} onChange={(e) => upd({ brandName: e.target.value })}><option value="">— choose —</option>{brands.map((b) => <option key={b}>{b}</option>)}</select></td>
                    <td><select value={p.locationCode} onChange={(e) => upd({ locationCode: e.target.value })}><option value="">— choose —</option>{activeLocations.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></td>
                    <td>{done ? <span className={`badge ${done.ok ? 'badge-green' : 'badge-red'}`} title={done.message}>{done.ok ? 'Activated' : 'Failed'}</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {byLocation.map((loc) => (
        <Section key={loc.code} title={`${loc.name} (${loc.stores.length})`} right={loc.stores.length > 0 ? (
          <div className="fh-row">
            <button className="btn-sm btn-danger" disabled={!!busy} onClick={() => setOnline(loc.stores.map((s) => s.id), false)}>Pause whole location</button>
            <button className="btn-sm btn-ok" disabled={!!busy} onClick={() => setOnline(loc.stores.map((s) => s.id), true)}>Resume whole location</button>
          </div>
        ) : undefined}>
          <PrepRow code={loc.code} value={prep[loc.code]} editable={can('stores:toggle')} busy={!!busy} onSave={savePrep} />
          {loc.stores.length === 0 ? <p className="small">No stores mapped here yet.</p> : (
            <table>
              <thead><tr><th>Brand</th><th>Channel</th><th>Store id</th><th>Clover</th><th>Auto-accept</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {loc.stores.map((s) => (
                  <tr key={s.id}>
                    <td>{s.brandName}</td>
                    <td>{CHANNELS.find(([k]) => k === s.channel)?.[1]}</td>
                    <td className="fh-mono">{s.channelStoreId}</td>
                    <td className="fh-mono">{s.cloverMerchantId || 'default'}</td>
                    <td>{s.autoAccept ? 'Yes' : 'No'}</td>
                    <td>
                      {(() => {
                        const ps = s.meta?.platformStatus;
                        const [label, cls] = ps?.state ? STATE_BADGE[ps.state] ?? [ps.state, 'badge-yellow'] : s.online ? STATE_BADGE.online : STATE_BADGE.paused;
                        const by = ps?.source === 'sync' || ps?.source === 'webhook' ? 'per platform' : ps?.source === 'dashboard' ? 'from TAKATAK' : '';
                        return <span className={`badge ${cls}`} title={[ps?.detail, ps?.error, ps?.checkedAt ? `checked ${new Date(ps.checkedAt).toLocaleString('fr-CA')}` : ''].filter(Boolean).join(' — ')}>{label}{by ? <span style={{ fontWeight: 400 }}>&nbsp;· {by}</span> : null}</span>;
                      })()}
                      {s.pausedUntil && !s.online && <div className="small">until {new Date(s.pausedUntil).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {s.online
                        ? <button className="btn-sm btn-danger" disabled={!!busy} onClick={() => setOnline([s.id], false)}>Pause</button>
                        : <button className="btn-sm btn-ok" disabled={!!busy} onClick={() => setOnline([s.id], true)}>Resume</button>}
                      {' '}<button className="btn-sm btn-light" onClick={() => setForm({ channel: s.channel, channelStoreId: s.channelStoreId, brandName: s.brandName, locationCode: s.locationCode, cloverMerchantId: s.cloverMerchantId || '', autoAccept: s.autoAccept })}>Edit</button>
                      {' '}<button className="btn-sm btn-light" onClick={() => remove(s.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ))}

      <Section title="Add or update a store mapping" right={<button className="btn-sm btn-light" disabled={!!busy} onClick={discover}>{busy === 'discover' ? 'Asking Uber…' : 'Discover Uber stores'}</button>}>
        <div className="fh-row" style={{ alignItems: 'flex-end' }}>
          <label className="small">Channel<br /><select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{CHANNELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="small">Store id<br /><input value={form.channelStoreId} placeholder={hint} onChange={(e) => setForm({ ...form, channelStoreId: e.target.value })} style={{ minWidth: 220 }} /></label>
          <label className="small">Brand<br /><select value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })}>{brands.map((b) => <option key={b}>{b}</option>)}</select></label>
          <label className="small">Location<br /><select value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })}>{activeLocations.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select></label>
          <label className="small">Clover merchant id (optional)<br /><input value={form.cloverMerchantId} placeholder="default merchant" onChange={(e) => setForm({ ...form, cloverMerchantId: e.target.value })} /></label>
          <label className="small fh-row"><input type="checkbox" checked={form.autoAccept} onChange={(e) => setForm({ ...form, autoAccept: e.target.checked })} /> Auto-accept</label>
        </div>
        <div style={{ marginTop: 12 }}><button disabled={!!busy || !form.channelStoreId || !form.brandName} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save mapping'}</button></div>
        {discovered.length > 0 && (
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Uber store</th><th>Store id</th><th></th></tr></thead>
            <tbody>
              {discovered.map((d) => (
                <tr key={d.id}><td>{d.name}<div className="small">{d.address}</div></td><td className="fh-mono">{d.id}</td>
                  <td><button className="btn-sm btn-light" onClick={() => setForm({ ...form, channel: 'uber_eats', channelStoreId: d.id })}>Use</button></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function PrepRow({ code, value, editable, busy, onSave }: { code: string; value?: { normal: number; busy: number; isBusy: boolean }; editable: boolean; busy: boolean; onSave: (code: string, patch: Partial<{ normal: number; busy: number; isBusy: boolean }>) => void }) {
  const [normal, setNormal] = useState(value?.normal ?? 15);
  const [busyMin, setBusyMin] = useState(value?.busy ?? 25);
  useEffect(() => { if (value) { setNormal(value.normal); setBusyMin(value.busy); } }, [value]);
  const changed = value ? normal !== value.normal || busyMin !== value.busy : false;
  return (
    <div className="fh-row fh-prep">
      <strong className="small">Kitchen prep time</strong>
      <label className="small">normal <input type="number" min={1} max={180} value={normal} disabled={!editable} onChange={(e) => setNormal(Number(e.target.value))} style={{ width: 64 }} /> min</label>
      <label className="small">busy <input type="number" min={1} max={180} value={busyMin} disabled={!editable} onChange={(e) => setBusyMin(Number(e.target.value))} style={{ width: 64 }} /> min</label>
      {editable && changed && <button className="btn-sm" disabled={busy} onClick={() => onSave(code, { normal, busy: busyMin })}>Save</button>}
      {editable
        ? <button className={`btn-sm ${value?.isBusy ? 'btn-danger' : 'btn-light'}`} disabled={busy} aria-pressed={Boolean(value?.isBusy)} onClick={() => onSave(code, { isBusy: !value?.isBusy })}>{value?.isBusy ? 'Busy mode ON — turn off' : 'Turn on busy mode'}</button>
        : <span className="small">{value?.isBusy ? 'Busy mode on' : ''}</span>}
      <span className="small">Sent to DoorDash with each confirmation and printed as “ready by” on every ticket.</span>
    </div>
  );
}
