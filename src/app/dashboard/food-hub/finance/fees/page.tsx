'use client';

// Commission plans — what each platform keeps, per platform and per store (RC9).
import { useCallback, useEffect, useState } from 'react';
import { api, useCatalog, useMe } from '@/app/dashboard/food-hub/ui';
import { CH_NAME, FinanceError, FinanceHead } from '../finance-ui';

type Plan = { plan: string; deliveryPct: number; pickupPct: number; fixedFee: number; taxOnFeesPct: number; payoutLagDays: number };
type Fees = { channels: Record<string, Plan>; stores: Record<string, Partial<Plan>>; confirmed: Record<string, boolean>; tolerance: number; updatedAt?: string };
type Preset = { plan: string; deliveryPct: number; pickupPct: number; note?: string };
type Store = { id: string; channel: string; brandName: string; locationCode: string; channelStoreId: string };

export default function FeesPage() {
  const { can } = useMe();
  const { locName } = useCatalog();
  const edit = can('finance:edit');
  const [fees, setFees] = useState<Fees | null>(null);
  const [presets, setPresets] = useState<Record<string, Preset[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [stores, setStores] = useState<Store[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [addFor, setAddFor] = useState('');

  const load = useCallback(() => api<{ fees: Fees; presets: Record<string, Preset[]>; notes: Record<string, string>; stores: Store[] }>('/api/food-hub/recon/fees')
    .then((d) => { setFees(d.fees); setPresets(d.presets); setNotes(d.notes); setStores(d.stores); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (!fees) return <div><FinanceHead title="Commission plans" intro="What each platform keeps from every order." /><FinanceError message={err} />{!err && <p className="small">Loading…</p>}</div>;

  const setPlan = (ch: string, p: Partial<Plan>) => setFees({ ...fees, channels: { ...fees.channels, [ch]: { ...fees.channels[ch], ...p } } });
  const setStore = (id: string, p: Partial<Plan> | null) => { const s = { ...fees.stores }; if (p) s[id] = { ...(s[id] ?? {}), ...p }; else delete s[id]; setFees({ ...fees, stores: s }); };
  const storeName = (id: string) => { const s = stores.find((x) => x.id === id); return s ? `${CH_NAME[s.channel] ?? s.channel} · ${s.brandName} · ${locName(s.locationCode)}` : id; };

  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await api<{ fees: Fees; cases: { opened: number; closed: number } | null }>('/api/food-hub/recon/fees', { method: 'PUT', json: { fees } });
      setFees(r.fees);
      setMsg(`Plans saved. Orders re-checked${r.cases ? `: ${r.cases.opened} new problem(s), ${r.cases.closed} closed` : ''}.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div>
      <FinanceHead title="Commission plans" intro="Expected payouts are calculated from these plans. They start from the platforms' published Canadian rate cards (Uber Eats and DoorDash); SkipTheDishes and Too Good To Go do not publish theirs, so enter the rates from your agreements. Tick “matches my contract” once checked — until then differences are flagged as unconfirmed."
        right={edit ? <button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save plans'}</button> : undefined} />
      <FinanceError message={err} />
      {msg && <div className="fh-banner info" role="status">{msg}</div>}

      {Object.entries(fees.channels).map(([ch, p]) => (
        <section key={ch} className="card" style={{ marginBottom: 14 }}>
          <div className="fh-head" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>{CH_NAME[ch] ?? ch}</h2>
            <label className="fh-row small"><input type="checkbox" checked={!!fees.confirmed[ch]} disabled={!edit} onChange={(e) => setFees({ ...fees, confirmed: { ...fees.confirmed, [ch]: e.target.checked } })} /> Matches my contract</label>
          </div>
          <div className="fin-plan">
            <label>Plan
              <select value={presets[ch]?.some((x) => x.plan === p.plan) ? p.plan : '__custom'} disabled={!edit} onChange={(e) => {
                const pr = presets[ch]?.find((x) => x.plan === e.target.value);
                setPlan(ch, pr ? { plan: pr.plan, deliveryPct: pr.deliveryPct, pickupPct: pr.pickupPct } : { plan: 'Custom' });
              }}>
                {(presets[ch] ?? []).map((x) => <option key={x.plan} value={x.plan}>{x.plan} — {x.deliveryPct}% / {x.pickupPct}%</option>)}
                <option value="__custom">Custom (my contract)</option>
              </select>
            </label>
            <label>Delivery commission %<input type="number" min={0} max={100} step={0.1} value={p.deliveryPct} disabled={!edit} onChange={(e) => setPlan(ch, { deliveryPct: num(e.target.value) })} /></label>
            <label>Pickup commission %<input type="number" min={0} max={100} step={0.1} value={p.pickupPct} disabled={!edit} onChange={(e) => setPlan(ch, { pickupPct: num(e.target.value) })} /></label>
            <label>Fixed fee per order ($)<input type="number" min={0} step={0.01} value={p.fixedFee} disabled={!edit} onChange={(e) => setPlan(ch, { fixedFee: num(e.target.value) })} /></label>
            <label>Tax charged on fees %<input type="number" min={0} max={30} step={0.001} value={p.taxOnFeesPct} disabled={!edit} onChange={(e) => setPlan(ch, { taxOnFeesPct: num(e.target.value) })} /></label>
            <label>Flag missing after (days)<input type="number" min={1} max={200} step={1} value={p.payoutLagDays} disabled={!edit} onChange={(e) => setPlan(ch, { payoutLagDays: num(e.target.value) })} /></label>
          </div>
          <p className="small" style={{ marginBottom: 0 }}>{notes[ch]}{presets[ch]?.find((x) => x.plan === p.plan)?.note ? ` ${presets[ch]!.find((x) => x.plan === p.plan)!.note}.` : ''} Tax on fees in Quebec is GST 5% + QST 9.975% = 14.975%, recoverable as input tax credits.</p>
        </section>
      ))}

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="fh-head" style={{ marginBottom: 8 }}><h2 style={{ margin: 0, fontSize: 17 }}>Stores with a different rate</h2></div>
        <p className="small">Some brands or locations can be on another plan (a promotion period, a different contract). Rates here replace the platform plan for that store only.</p>
        <table className="fin-table">
          <thead><tr><th>Store</th><th>Plan name</th><th>Delivery %</th><th>Pickup %</th><th></th></tr></thead>
          <tbody>
            {Object.entries(fees.stores).map(([id, o]) => (
              <tr key={id}>
                <td className="small">{storeName(id)}</td>
                <td><input value={o.plan ?? ''} disabled={!edit} onChange={(e) => setStore(id, { plan: e.target.value })} placeholder="e.g. Plus" style={{ width: 120 }} /></td>
                <td><input type="number" min={0} max={100} step={0.1} value={o.deliveryPct ?? ''} disabled={!edit} onChange={(e) => setStore(id, { deliveryPct: e.target.value === '' ? undefined : Number(e.target.value) })} /></td>
                <td><input type="number" min={0} max={100} step={0.1} value={o.pickupPct ?? ''} disabled={!edit} onChange={(e) => setStore(id, { pickupPct: e.target.value === '' ? undefined : Number(e.target.value) })} /></td>
                <td>{edit && <button className="btn-sm btn-light" onClick={() => setStore(id, null)}>Remove</button>}</td>
              </tr>
            ))}
            {Object.keys(fees.stores).length === 0 && <tr><td colSpan={5} className="small">Every store uses its platform plan.</td></tr>}
          </tbody>
        </table>
        {edit && (
          <div className="fh-row" style={{ marginTop: 10 }}>
            <select value={addFor} onChange={(e) => setAddFor(e.target.value)} aria-label="Store">
              <option value="">Add a store…</option>
              {stores.filter((s) => !fees.stores[s.id]).sort((a, b) => storeName(a.id).localeCompare(storeName(b.id))).map((s) => <option key={s.id} value={s.id}>{storeName(s.id)}</option>)}
            </select>
            <button className="btn-sm btn-light" disabled={!addFor} onClick={() => { const ch = stores.find((s) => s.id === addFor)?.channel ?? ''; const base = fees.channels[ch]; setStore(addFor, { plan: base?.plan, deliveryPct: base?.deliveryPct, pickupPct: base?.pickupPct }); setAddFor(''); }}>Add</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Matching tolerance</h2>
        <label className="fh-row small">A payout within <input type="number" min={0} max={5} step={0.01} value={fees.tolerance} disabled={!edit} onChange={(e) => setFees({ ...fees, tolerance: num(e.target.value) })} /> $ of the expected amount counts as “paid as expected” (rounding of taxes and fees).</label>
        <p className="small" style={{ marginBottom: 0 }}>Dispute cases are only opened for $1.00 or more.{fees.updatedAt ? ` Last saved ${new Date(fees.updatedAt).toLocaleString('en-CA')}.` : ''}</p>
      </section>
    </div>
  );
}
