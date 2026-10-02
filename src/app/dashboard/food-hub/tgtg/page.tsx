'use client';

// Too Good To Go — daily Surprise Bag log (RC9).
// TGTG has no public store API: bags are set in the TGTG Store app. Logging the day here puts TGTG
// in sales, analytics, reports and payout reconciliation — without double counting when real TGTG
// orders already arrive by webhook (Deliverect feed).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatTile, fmtInt } from '../charts';
import { api, downloadCsv, Section, useCatalog, useMe } from '../ui';

type BagDay = { id: string; date: string; locationCode: string; bagsOffered: number; bagsSold: number; pricePerBag: number; note?: string; by: string; at: string; orderId: string | null; feedOrders: number };
const cad = (n: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PRICE_KEY = 'takatak.tgtg.price';

export default function TgtgPage() {
  const { activeLocations, locName } = useCatalog();
  const { me, can } = useMe();
  const mine = useMemo(() => activeLocations.filter((l) => !me?.locations.length || me.locations.includes(l.code)), [activeLocations, me]);
  const [days, setDays] = useState<BagDay[]>([]);
  const [form, setForm] = useState({ date: ymd(new Date()), locationCode: '', bagsOffered: '', bagsSold: '', pricePerBag: '', note: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const from = new Date(); from.setDate(from.getDate() - 60);
    return api<{ days: BagDay[] }>(`/api/food-hub/tgtg?from=${ymd(from)}`).then((d) => setDays(d.days)).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setForm((f) => ({ ...f, locationCode: f.locationCode || mine[0]?.code || '' }));
  }, [mine]);
  useEffect(() => { try { const p = window.localStorage.getItem(PRICE_KEY); if (p) setForm((f) => ({ ...f, pricePerBag: f.pricePerBag || p })); } catch { /* private mode */ } }, []);

  // Editing an existing day: load it into the form.
  useEffect(() => {
    const d = days.find((x) => x.date === form.date && x.locationCode === form.locationCode);
    if (d) setForm((f) => ({ ...f, bagsOffered: String(d.bagsOffered), bagsSold: String(d.bagsSold), pricePerBag: String(d.pricePerBag), note: d.note ?? '' }));
    else setForm((f) => ({ ...f, bagsOffered: '', bagsSold: '', note: '' }));
  }, [form.date, form.locationCode, days]);

  async function save() {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await api<{ day: BagDay }>('/api/food-hub/tgtg', { method: 'POST', json: { ...form, bagsOffered: Number(form.bagsOffered), bagsSold: Number(form.bagsSold), pricePerBag: Number(form.pricePerBag) } });
      try { window.localStorage.setItem(PRICE_KEY, form.pricePerBag); } catch { /* ignore */ }
      setMsg(r.day.feedOrders
        ? `Saved. ${r.day.feedOrders} Too Good To Go order(s) already arrived by webhook for that day, so the log is kept for your records but not counted again in sales.`
        : `Saved: ${r.day.bagsSold} bag(s) × ${cad(r.day.pricePerBag)} = ${cad(r.day.bagsSold * r.day.pricePerBag)} counted as Too Good To Go sales for ${locName(r.day.locationCode)}.`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const last7 = useMemo(() => { const from = new Date(); from.setDate(from.getDate() - 6); const f = ymd(from); return days.filter((d) => d.date >= f); }, [days]);
  const sold = last7.reduce((s, d) => s + d.bagsSold, 0);
  const offered = last7.reduce((s, d) => s + d.bagsOffered, 0);
  const sales = last7.filter((d) => !d.feedOrders).reduce((s, d) => s + d.bagsSold * d.pricePerBag, 0);

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Too Good To Go bags</h1>
          <div className="small" style={{ maxWidth: 820 }}>Too Good To Go has no public store API — bag quantities are set in the TGTG Store app. Enter each day’s bags here (takes 10 seconds at closing) and they count in sales, analytics, reports and payout checks. If TGTG orders already reach Food Hub through an integration, the log is not counted twice.</div>
        </div>
      </div>
      {err && <div className="fh-banner warn" role="alert">{err}</div>}
      {msg && <div className="fh-banner info" role="status">{msg}</div>}

      <div className="viz-stats">
        <StatTile hero label="Bags sold — last 7 days" value={fmtInt(sold)} note={offered ? `${Math.round((sold / offered) * 100)}% of ${fmtInt(offered)} offered` : 'no day logged yet'} />
        <StatTile label="TGTG sales — last 7 days" value={cad(sales)} note="customer price, before TGTG’s fee" />
        <StatTile label="Unsold bags — last 7 days" value={fmtInt(Math.max(0, offered - sold))} note="food that was not rescued" />
      </div>

      {can('orders:act') && (
        <Section title="Log a day">
          <div className="fin-plan">
            <label>Date<input type="date" value={form.date} max={ymd(new Date())} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label>Location
              <select value={form.locationCode} onChange={(e) => setForm({ ...form, locationCode: e.target.value })}>
                {mine.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            <label>Bags offered<input type="number" min={0} step={1} value={form.bagsOffered} onChange={(e) => setForm({ ...form, bagsOffered: e.target.value })} /></label>
            <label>Bags sold (picked up)<input type="number" min={0} step={1} value={form.bagsSold} onChange={(e) => setForm({ ...form, bagsSold: e.target.value })} /></label>
            <label>Price customers pay per bag ($)<input type="number" min={0} step={0.01} value={form.pricePerBag} onChange={(e) => setForm({ ...form, pricePerBag: e.target.value })} /></label>
            <label>Note<input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="optional" /></label>
          </div>
          <div className="fh-row" style={{ marginTop: 12 }}>
            <button disabled={busy || !form.locationCode || form.bagsSold === ''} onClick={save}>{busy ? 'Saving…' : 'Save day'}</button>
            {form.bagsSold !== '' && form.pricePerBag !== '' && <span className="small">= {cad(Number(form.bagsSold) * Number(form.pricePerBag))} in Too Good To Go sales</span>}
          </div>
        </Section>
      )}

      <Section title="Last 60 days" right={<button className="btn-sm btn-light" disabled={!days.length} onClick={() => downloadCsv('tgtg-bags', ['Date', 'Location', 'Offered', 'Sold', 'Price', 'Sales', 'Counted as sales', 'Note', 'By'], days.map((d) => [d.date, d.locationCode, d.bagsOffered, d.bagsSold, d.pricePerBag.toFixed(2), (d.bagsSold * d.pricePerBag).toFixed(2), d.feedOrders ? 'no — orders came by webhook' : d.bagsSold ? 'yes' : 'no', d.note ?? '', d.by]))}>Download CSV</button>}>
        <div className="fh-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Date</th><th>Location</th><th className="num">Offered</th><th className="num">Sold</th><th className="num">Price</th><th className="num">Sales</th><th>Counted</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.id}>
                  <td>{d.date}</td><td className="small">{locName(d.locationCode)}</td>
                  <td className="num">{d.bagsOffered}</td><td className="num">{d.bagsSold}</td><td className="num">{cad(d.pricePerBag)}</td><td className="num">{cad(d.bagsSold * d.pricePerBag)}</td>
                  <td>{d.feedOrders ? <span className="badge badge-blue">– Orders came by webhook</span> : d.bagsSold ? <span className="badge badge-green">✓ In sales</span> : <span className="small">nothing sold</span>}</td>
                  <td className="small">{d.note ?? ''}</td><td className="small">{d.by}</td>
                </tr>
              ))}
              {days.length === 0 && <tr><td colSpan={9} className="small">No day logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
