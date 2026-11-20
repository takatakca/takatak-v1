'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fullWeekUi, MultiPick, Section, useCatalog, useMe, WEEK_DAYS, WeekEditor, weekProblems, type Slot, type Week } from '../ui';

type Holiday = { id: string; date: string; name: string; locationCodes: string[]; closed: boolean; slots?: Slot[] };
type Hours = { locations: Record<string, Week>; brands: Record<string, Week>; holidays: Holiday[]; updatedAt?: string };
type PublishRow = { brand: string; ok: boolean; message: string };

const QC_HOLIDAYS = (year: number): Array<[string, string]> => {
  // Fixed-date Québec statutory holidays; movable ones (Easter, Victoria/Patriots, Labour, Thanksgiving) are added by hand.
  return [[`${year}-01-01`, "New Year's Day"], [`${year}-06-24`, 'Fête nationale du Québec'], [`${year}-07-01`, 'Canada Day'], [`${year}-12-25`, 'Christmas Day']];
};

function slotsLabel(w?: Week) {
  if (!w) return 'not set';
  const open = WEEK_DAYS.filter(([d]) => (w[d] ?? []).length).length;
  return open === 0 ? 'closed every day' : `${open}/7 days open`;
}

// Store hours (Atlas "Store hours, holiday hours & category schedules").
export default function HoursPage() {
  const { activeLocations, locName, brands } = useCatalog();
  const { can } = useMe();
  const [hours, setHours] = useState<Hours | null>(null);
  const [tab, setTab] = useState<'locations' | 'brands' | 'holidays'>('locations');
  const [loc, setLoc] = useState('');
  const [brand, setBrand] = useState('');
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [published, setPublished] = useState<PublishRow[]>([]);
  const editable = can('menu:edit');

  const load = useCallback(() => api<{ hours: Hours }>('/api/food-hub/hours').then((d) => { setHours(d.hours); setDirty(false); }).catch((e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!loc && activeLocations.length) setLoc(activeLocations[0].code); }, [activeLocations, loc]);
  const brandNames = useMemo(() => brands.filter((b) => b.active).map((b) => b.name), [brands]);
  useEffect(() => { if (!brand && brandNames.length) setBrand(brandNames[0]); }, [brandNames, brand]);

  function patch(fn: (h: Hours) => Hours) { setHours((h) => (h ? fn(h) : h)); setDirty(true); }

  const problems = useMemo(() => {
    if (!hours) return [];
    return [
      ...Object.entries(hours.locations).flatMap(([k, w]) => weekProblems(w).map((p) => `${locName(k)} — ${p}`)),
      ...Object.entries(hours.brands).flatMap(([k, w]) => weekProblems(w).map((p) => `${k} — ${p}`)),
      ...hours.holidays.filter((h) => !/^\d{4}-\d{2}-\d{2}$/.test(h.date)).map((h) => `Holiday "${h.name}" needs a date`),
    ];
  }, [hours, locName]);

  async function save() {
    if (!hours) return;
    setBusy('save'); setMsg('');
    try {
      const d = await api<{ hours: Hours }>('/api/food-hub/hours', { method: 'PUT', json: { hours } });
      setHours(d.hours); setDirty(false);
      setMsg('Saved. Publish to send the new hours to Uber Eats, DoorDash and SkipTheDishes.');
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(''); }
  }

  // Hours travel with the menu on every platform, so "publish hours" = publish every brand's menu.
  async function publishAll() {
    if (dirty) { setMsg('Save first.'); return; }
    if (!window.confirm('Publish menus (with these hours and holidays) for every brand that has mapped stores?')) return;
    setBusy('publish'); setPublished([]); setMsg('');
    const d = await api<{ brands: string[]; summary: Array<{ brandName: string; items: number }> }>('/api/food-hub/menu').catch(() => ({ brands: [], summary: [] }));
    const withMenu = d.summary.filter((s) => s.items > 0).map((s) => s.brandName);
    const rows: PublishRow[] = [];
    for (const b of withMenu) {
      try {
        const r = await api<{ results: Array<{ result: { ok: boolean; status: string } }> }>('/api/food-hub/menu/publish', { method: 'POST', json: { brand: b } });
        const okN = r.results.filter((x) => x.result.ok).length;
        rows.push({ brand: b, ok: okN === r.results.length, message: `${okN}/${r.results.length} store(s) accepted` });
      } catch (e) { rows.push({ brand: b, ok: false, message: e instanceof Error ? e.message : String(e) }); }
      setPublished([...rows]);
    }
    setMsg(withMenu.length ? `Published ${rows.filter((r) => r.ok).length}/${withMenu.length} brand(s).` : 'No brand has a saved menu yet — set up menus in Menu Manager first.');
    setBusy('');
  }

  if (!hours) return <div><h1>Store hours</h1><p className="small">{msg || 'Loading…'}</p></div>;
  const locWeek = hours.locations[loc];
  const brandWeek = hours.brands[brand];
  const upcoming = [...hours.holidays].sort((a, b) => a.date.localeCompare(b.date));
  const year = new Date().getFullYear();

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Store hours</h1>
          <div className="small">Opening hours per location, brand exceptions and holidays — published to every platform with the menu. Times are Montréal time.</div>
        </div>
        {editable && (
          <div className="fh-row">
            <button disabled={!dirty || !!busy || problems.length > 0} onClick={save}>{busy === 'save' ? 'Saving…' : dirty ? 'Save hours' : 'Saved'}</button>
            <button className="btn-ok" disabled={!!busy} onClick={publishAll}>{busy === 'publish' ? 'Publishing…' : 'Publish to platforms'}</button>
          </div>
        )}
      </div>
      {msg && <div className="fh-banner info">{msg}</div>}
      {problems.length > 0 && <div className="fh-banner warn">{problems.slice(0, 4).join(' · ')}</div>}
      {published.length > 0 && (
        <table className="fh-result" style={{ marginBottom: 14 }}>
          <thead><tr><th>Brand</th><th>Result</th></tr></thead>
          <tbody>{published.map((r) => <tr key={r.brand}><td>{r.brand}</td><td><span className={`badge ${r.ok ? 'badge-green' : 'badge-red'}`}>{r.ok ? 'sent' : 'check'}</span> <span className="small">{r.message}</span></td></tr>)}</tbody>
        </table>
      )}

      <div className="fh-tabs" role="tablist">
        {(['locations', 'brands', 'holidays'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'locations' ? 'Locations' : t === 'brands' ? 'Brand exceptions' : `Holidays (${hours.holidays.length})`}
          </button>
        ))}
      </div>

      {tab === 'locations' && (
        <Section title="Location hours" right={<select value={loc} onChange={(e) => setLoc(e.target.value)}>{activeLocations.map((l) => <option key={l.code} value={l.code}>{l.name} — {slotsLabel(hours.locations[l.code])}</option>)}</select>}>
          {!locWeek ? (
            <div>
              <p className="small">No hours set for {locName(loc)}. A menu published without hours shows the store open 24/7 on the platforms — set the hours before publishing.</p>
              {editable && <button onClick={() => patch((h) => ({ ...h, locations: { ...h.locations, [loc]: fullWeekUi() } }))}>Set hours for {locName(loc)}</button>}
            </div>
          ) : (
            <>
              <WeekEditor value={locWeek} disabled={!editable} onChange={(w) => patch((h) => ({ ...h, locations: { ...h.locations, [loc]: w } }))} />
              {editable && (
                <div className="fh-row" style={{ marginTop: 10 }}>
                  <span className="small">Copy these hours to:</span>
                  {activeLocations.filter((l) => l.code !== loc).map((l) => (
                    <button key={l.code} className="btn-sm btn-light" onClick={() => patch((h) => ({ ...h, locations: { ...h.locations, [l.code]: JSON.parse(JSON.stringify(locWeek)) } }))}>{l.name}</button>
                  ))}
                  <span className="cc-grow" />
                  <button className="btn-sm btn-light" onClick={() => { if (window.confirm(`Remove the hours for ${locName(loc)}?`)) patch((h) => { const next = { ...h.locations }; delete next[loc]; return { ...h, locations: next }; }); }}>Remove hours</button>
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {tab === 'brands' && (
        <Section title="Brand exceptions" right={<select value={brand} onChange={(e) => setBrand(e.target.value)}>{brandNames.map((b) => <option key={b} value={b}>{b}{hours.brands[b] ? ' — custom hours' : ''}</option>)}</select>}>
          <p className="small">A brand exception replaces the location hours for that brand at every location (for example a breakfast-only brand). Leave it off to follow the location hours.</p>
          {!brandWeek ? (
            editable && <button onClick={() => patch((h) => ({ ...h, brands: { ...h.brands, [brand]: hours.locations[loc] ? JSON.parse(JSON.stringify(hours.locations[loc])) : fullWeekUi() } }))}>Give {brand} its own hours</button>
          ) : (
            <>
              <WeekEditor value={brandWeek} disabled={!editable} onChange={(w) => patch((h) => ({ ...h, brands: { ...h.brands, [brand]: w } }))} />
              {editable && <button className="btn-light" style={{ marginTop: 10 }} onClick={() => patch((h) => { const next = { ...h.brands }; delete next[brand]; return { ...h, brands: next }; })}>Follow location hours again</button>}
            </>
          )}
        </Section>
      )}

      {tab === 'holidays' && (
        <Section title="Holidays & special days" right={editable ? (
          <div className="fh-row">
            <button className="btn-sm btn-light" onClick={() => patch((h) => ({ ...h, holidays: [...h.holidays, ...QC_HOLIDAYS(year).filter(([d]) => !h.holidays.some((x) => x.date === d)).map(([date, name]) => ({ id: `hol-${date}`, date, name, locationCodes: [], closed: true, slots: [] }))] }))}>Add Québec holidays {year}</button>
            <button className="btn-sm" onClick={() => patch((h) => ({ ...h, holidays: [...h.holidays, { id: `hol-${Date.now().toString(36)}`, date: '', name: 'Holiday', locationCodes: [], closed: true, slots: [] }] }))}>+ Add day</button>
          </div>
        ) : undefined}>
          <p className="small">Closed days and special hours are sent to Uber Eats (holiday hours) and DoorDash (special hours) when you publish. SkipTheDishes has no holiday API — TAKATAK takes the Skip stores offline for the day automatically and brings them back after midnight.</p>
          <table>
            <thead><tr><th>Date</th><th>Name</th><th>Locations</th><th>Hours</th><th></th></tr></thead>
            <tbody>
              {upcoming.map((hol) => {
                const set = (p: Partial<Holiday>) => patch((h) => ({ ...h, holidays: h.holidays.map((x) => (x.id === hol.id ? { ...x, ...p } : x)) }));
                return (
                  <tr key={hol.id}>
                    <td><input type="date" value={hol.date} disabled={!editable} onChange={(e) => set({ date: e.target.value })} /></td>
                    <td><input value={hol.name} disabled={!editable} onChange={(e) => set({ name: e.target.value })} /></td>
                    <td><MultiPick label="Locations" options={activeLocations.map((l) => [l.code, l.name])} value={hol.locationCodes} onChange={(v) => set({ locationCodes: v })} /></td>
                    <td>
                      <label className="fh-row small"><input type="checkbox" checked={hol.closed} disabled={!editable} onChange={(e) => set({ closed: e.target.checked, slots: e.target.checked ? [] : [{ open: '12:00', close: '20:00' }] })} /> Closed all day</label>
                      {!hol.closed && (hol.slots ?? []).map((s, i) => (
                        <span key={i} className="fh-slot" style={{ marginTop: 4 }}>
                          <input type="time" value={s.open} disabled={!editable} onChange={(e) => set({ slots: (hol.slots ?? []).map((x, j) => (j === i ? { ...x, open: e.target.value } : x)) })} />–
                          <input type="time" value={s.close} disabled={!editable} onChange={(e) => set({ slots: (hol.slots ?? []).map((x, j) => (j === i ? { ...x, close: e.target.value } : x)) })} />
                        </span>
                      ))}
                    </td>
                    <td>{editable && <button className="btn-sm btn-light" onClick={() => patch((h) => ({ ...h, holidays: h.holidays.filter((x) => x.id !== hol.id) }))}>Remove</button>}</td>
                  </tr>
                );
              })}
              {upcoming.length === 0 && <tr><td colSpan={5} className="small">No holidays yet.</td></tr>}
            </tbody>
          </table>
        </Section>
      )}
      <p className="small">Category schedules (breakfast menu, lunch specials) are set per category in Menu Manager. Last saved: {hours.updatedAt ? new Date(hours.updatedAt).toLocaleString('fr-CA') : 'never'}.</p>
    </div>
  );
}

