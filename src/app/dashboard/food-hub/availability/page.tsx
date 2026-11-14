'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ResultsTable, useCatalog, useMe } from '../ui';

type Menu = {
  brandName: string;
  items: Array<{ ref: string; name: string; categoryRef: string; available: boolean }>;
  categories: Array<{ ref: string; name: string }>;
  modifierGroups: Array<{ ref: string; name: string; modifiers: Array<{ ref: string; name: string; available: boolean }> }>;
  unavailableByLocation?: Record<string, string[]>;
  unavailableUntil?: Record<string, number>;
};
type Row = { ref: string; name: string; group: string };

const DURATIONS: Array<[string, number]> = [['Until I turn it back on', 0], ['30 minutes', 30], ['1 hour', 60], ['2 hours', 120], ['4 hours', 240], ['Rest of today', -1]];

function minutesUntilEndOfDay() {
  const end = new Date(); end.setHours(23, 59, 0, 0);
  return Math.max(5, Math.round((end.getTime() - Date.now()) / 60000));
}

// 86 Board (Atlas "Item & modifier availability"): sold out at one location → off on every platform there.
export default function AvailabilityPage() {
  const { activeLocations } = useCatalog();
  const { me } = useMe();
  const [brands, setBrands] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [location, setLocation] = useState('');
  const [tab, setTab] = useState<'items' | 'options' | 'off'>('items');
  const [menu, setMenu] = useState<Menu | null>(null);
  const [duration, setDuration] = useState(0);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const myLocations = useMemo(() => activeLocations.filter((l) => !me?.locations.length || me.locations.includes(l.code)), [activeLocations, me]);
  const allowAll = !me?.locations.length;
  useEffect(() => { if (!location && myLocations.length) setLocation(myLocations[0].code); }, [myLocations, location]);
  useEffect(() => { api<{ brands: string[] }>('/api/food-hub/menu').then((d) => { setBrands(d.brands); setBrand(d.brands[0] || ''); }).catch((e) => setMsg(e.message)); }, []);
  const load = useCallback(async () => {
    if (!brand) return;
    const d = await api<{ menu: Menu }>(`/api/food-hub/menu?brand=${encodeURIComponent(brand)}`);
    setMenu(d.menu); setPicked([]);
  }, [brand]);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  const locs = location === '*' ? Object.keys(menu?.unavailableByLocation ?? {}) : [location];
  const offAt = (ref: string) => locs.filter((l) => (menu?.unavailableByLocation?.[l] ?? []).includes(ref));
  const untilOf = (ref: string) => locs.map((l) => menu?.unavailableUntil?.[`${l}|${ref}`]).filter(Boolean).sort()[0] as number | undefined;

  const rows: Row[] = useMemo(() => {
    if (!menu) return [];
    const catName = (r: string) => menu.categories.find((c) => c.ref === r)?.name ?? '';
    const itemRows = menu.items.map((i) => ({ ref: i.ref, name: i.name, group: catName(i.categoryRef) }));
    const modRows = menu.modifierGroups.flatMap((g) => g.modifiers.map((m) => ({ ref: m.ref, name: m.name, group: `Option · ${g.name}` })));
    const base = tab === 'items' ? itemRows : tab === 'options' ? modRows : [...itemRows, ...modRows].filter((r) => offAt(r.ref).length);
    return base.filter((r) => !filter || `${r.name} ${r.group}`.toLowerCase().includes(filter.toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, tab, filter, location]);
  const offCount = useMemo(() => {
    if (!menu) return 0;
    const all = [...menu.items.map((i) => i.ref), ...menu.modifierGroups.flatMap((g) => g.modifiers.map((m) => m.ref))];
    return all.filter((r) => offAt(r).length).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, location]);

  async function toggle(refs: string[], available: boolean) {
    if (!refs.length) return;
    setBusy(refs.join(',')); setMsg('');
    try {
      const minutes = available ? 0 : duration === -1 ? minutesUntilEndOfDay() : duration;
      const d = await api<{ results: any[] }>('/api/food-hub/availability', { method: 'POST', json: { brand, locationCode: location === '*' ? undefined : location, itemRefs: refs, available, minutes } });
      setResults(d.results);
      if (!d.results.length) setMsg('Saved in Food Hub. No stores are mapped for this brand at this location yet, so no platform was updated.');
      else setMsg(`${available ? 'Back on' : "86'd"}: ${refs.length} ${refs.length === 1 ? 'entry' : 'entries'}${!available && minutes ? ` — comes back automatically in ${minutes >= 60 ? `${Math.round(minutes / 6) / 10} h` : `${minutes} min`}` : ''}.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  }

  const time = (ms: number) => new Date(ms).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>86 Board</h1>
          <div className="small">Mark an item or option sold out once — it turns off on Uber Eats, DoorDash and SkipTheDishes at that location, and can come back by itself.</div>
        </div>
        <div className="fh-row">
          <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand">{brands.map((b) => <option key={b}>{b}</option>)}</select>
          <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location">
            {allowAll && <option value="*">All locations</option>}
            {myLocations.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label="For how long">{DURATIONS.map(([l, v]) => <option key={l} value={v}>{l}</option>)}</select>
        </div>
      </div>
      {msg && <div className="fh-banner info">{msg}</div>}
      <ResultsTable results={results} />

      <div className="fh-row" style={{ marginBottom: 10 }}>
        <div className="fh-tabs" role="tablist" style={{ marginBottom: 0 }}>
          <button role="tab" aria-selected={tab === 'items'} className={tab === 'items' ? 'on' : ''} onClick={() => { setTab('items'); setPicked([]); }}>Items ({menu?.items.length ?? 0})</button>
          <button role="tab" aria-selected={tab === 'options'} className={tab === 'options' ? 'on' : ''} onClick={() => { setTab('options'); setPicked([]); }}>Options ({menu?.modifierGroups.reduce((s, g) => s + g.modifiers.length, 0) ?? 0})</button>
          <button role="tab" aria-selected={tab === 'off'} className={tab === 'off' ? 'on' : ''} onClick={() => { setTab('off'); setPicked([]); }}>Currently 86’d ({offCount})</button>
        </div>
        <input type="search" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {picked.length > 0 && <>
          <span className="small">{picked.length} selected</span>
          <button className="btn-sm btn-danger" disabled={!!busy} onClick={() => toggle(picked, false)}>86 selected</button>
          <button className="btn-sm btn-ok" disabled={!!busy} onClick={() => toggle(picked, true)}>Back on</button>
        </>}
      </div>

      <div className="card">
        {rows.length === 0 && <p className="small">{tab === 'off' ? 'Nothing is 86’d here.' : 'No entries for this brand yet. Import the menu from Clover in Menu Manager.'}</p>}
        <table>
          <tbody>
            {rows.map((r) => {
              const off = offAt(r.ref);
              const until = untilOf(r.ref);
              return (
                <tr key={r.ref}>
                  <td style={{ width: 30 }}><input type="checkbox" checked={picked.includes(r.ref)} onChange={(e) => setPicked(e.target.checked ? [...picked, r.ref] : picked.filter((x) => x !== r.ref))} aria-label={`Select ${r.name}`} /></td>
                  <td>{r.name}<div className="small">{r.group}</div></td>
                  <td>
                    {off.length ? <span className="badge badge-red">86’d{location === '*' ? ` at ${off.length}` : ''}</span> : <span className="badge badge-green">Available</span>}
                    {until && <span className="small"> back at {time(until)}</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {off.length
                      ? <button className="btn-sm btn-ok" disabled={!!busy} onClick={() => toggle([r.ref], true)}>{busy === r.ref ? '…' : 'Back on'}</button>
                      : <button className="btn-sm btn-danger" disabled={!!busy} onClick={() => toggle([r.ref], false)}>{busy === r.ref ? '…' : '86 it'}</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small">Options (sauces, sizes, extras) are switched off with the platforms’ modifier APIs: DoorDash item options, Uber Eats modifier items, and SkipTheDishes item availability.</p>
    </div>
  );
}
