'use client';

// Payouts & deposits — each platform payout from its statement, next to what reached the bank (RC9).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatTile, fmtInt } from '@/app/dashboard/food-hub/charts';
import { api, downloadCsv, Modal, useCatalog, useFilters, useMe } from '@/app/dashboard/food-hub/ui';
import { CH_NAME, FinanceError, FinanceFilters, FinanceHead, cad, day, signed } from '../finance-ui';

type Batch = {
  key: string; channel: string; payoutRef: string | null; payoutDate: string | null; lines: number; orders: number; sales: number; tax: number; commission: number; commissionTax: number;
  promotions: number; adjustments: number; otherFees: number; refunds: number; net: number; hasBreakdown: boolean; deposit: { amount: number; date: string; note?: string; by: string } | null; gap: number | null;
};

export default function PayoutsPage() {
  const { filters, set, query } = useFilters('last_month');
  const { activeLocations } = useCatalog();
  const { can } = useMe();
  const [rows, setRows] = useState<Batch[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [dep, setDep] = useState<Batch | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => api<{ payouts: Batch[] }>(`/api/food-hub/recon/payouts?${query}`).then((d) => { setRows(d.payouts); setErr(''); setLoaded(true); }).catch((e) => setErr(e.message)), [query]);
  useEffect(() => { load(); }, [load]);

  const t = useMemo(() => ({
    net: rows.reduce((s, b) => s + b.net, 0),
    deposited: rows.reduce((s, b) => s + (b.deposit?.amount ?? 0), 0),
    waiting: rows.filter((b) => !b.deposit).length,
    gaps: rows.filter((b) => b.gap !== null && Math.abs(b.gap) >= 0.01),
    fees: rows.reduce((s, b) => s + b.commission + b.commissionTax, 0),
  }), [rows]);

  function exportCsv() {
    downloadCsv(`payouts-${filters.from}-${filters.to}`, ['Payout date', 'Platform', 'Payout id', 'Orders', 'Lines', 'Food sales', 'Tax collected', 'Commission', 'Tax on commission', 'Promotions', 'Adjustments', 'Refunds', 'Other fees', 'Net (statement)', 'Bank deposit', 'Deposit date', 'Gap'],
      rows.map((b) => [b.payoutDate ?? '', CH_NAME[b.channel] ?? b.channel, b.payoutRef ?? '', b.orders, b.lines, b.sales.toFixed(2), b.tax.toFixed(2), b.commission.toFixed(2), b.commissionTax.toFixed(2), b.promotions.toFixed(2), b.adjustments.toFixed(2), b.refunds.toFixed(2), b.otherFees.toFixed(2), b.net.toFixed(2), b.deposit?.amount.toFixed(2) ?? '', b.deposit?.date ?? '', b.gap?.toFixed(2) ?? '']));
  }

  return (
    <div>
      <FinanceHead title="Payouts & deposits" intro="Each payout as the platform's statement describes it — sales, commission, tax on fees, promotions, refunds — and the amount that actually reached your bank account. Enter the deposit from your bank statement to close the loop." />
      <FinanceError message={err} />
      {msg && <div className="fh-banner info" role="status">{msg}</div>}
      <FinanceFilters filters={filters} set={set} locations={activeLocations} showLocations={false} extra={<button className="btn-sm btn-light" onClick={exportCsv} disabled={!rows.length}>Download CSV</button>} />
      <div className="viz-stats">
        <StatTile hero label="Paid out (statements)" value={cad(t.net)} note={`${fmtInt(rows.length)} payout(s)`} />
        <StatTile label="Reached the bank" value={cad(t.deposited)} note={`${t.waiting} payout(s) without a deposit entered`} />
        <StatTile label="Deposits that differ" value={fmtInt(t.gaps.length)} note={t.gaps.length ? signed(t.gaps.reduce((s, b) => s + (b.gap ?? 0), 0)) : 'none'} />
        <StatTile label="Commission + tax on fees" value={cad(t.fees)} note="tax on fees is recoverable (ITC / ITR)" />
      </div>

      <section className="card">
        <div className="fh-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Payout</th><th>Platform</th><th className="num">Orders</th><th className="num">Food sales</th><th className="num">Tax collected</th><th className="num">Commission + tax</th><th className="num">Everything else</th><th className="num">Net paid</th><th className="num">Bank deposit</th></tr></thead>
            <tbody>
              {rows.map((b) => {
                const fees = b.commission + b.commissionTax;
                const rest = Math.round((b.net - b.sales - b.tax + fees) * 100) / 100;
                const ref = b.payoutRef ?? (b.key.split('|')[1] ?? '');
                return (
                  <tr key={b.key}>
                    <td>{b.payoutDate ? day(b.payoutDate) : ref.startsWith('week-') ? `Week of ${ref.slice(5)}` : '—'}{b.payoutRef && <div className="small fh-mono">{b.payoutRef}</div>}</td>
                    <td>{CH_NAME[b.channel] ?? b.channel}{!b.hasBreakdown && <div className="small">net only</div>}</td>
                    <td className="num">{b.orders}</td>
                    <td className="num">{b.hasBreakdown ? cad(b.sales) : '—'}</td>
                    <td className="num">{b.hasBreakdown ? cad(b.tax) : '—'}</td>
                    <td className="num">{b.hasBreakdown ? (fees ? `−${cad(fees)}` : cad(0)) : '—'}</td>
                    <td className="num" title="Promotions, adjustments, refunds, error charges, ads and other fees">{b.hasBreakdown ? signed(rest) : '—'}</td>
                    <td className="num"><strong>{cad(b.net)}</strong></td>
                    <td className="num">
                      {b.deposit ? <>{cad(b.deposit.amount)}<div className="small">{day(b.deposit.date)}</div>{b.gap !== null && Math.abs(b.gap) >= 0.01 ? <div className="small fin-bad">✕ {signed(b.gap)}</div> : <div className="small fin-good">✓ matches</div>}</> : !can('finance:edit') && <span className="small">not entered</span>}
                      {can('finance:edit') && <button className="btn-sm btn-light" style={{ marginTop: b.deposit ? 4 : 0 }} onClick={() => setDep(b)}>{b.deposit ? 'Edit' : 'Enter deposit'}</button>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="small">{loaded ? 'No payout in this period. Import the statements in Statements.' : 'Loading…'}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="small" style={{ marginTop: 8 }}>Food sales + tax − commission and its tax + everything else = net paid. “Everything else” is promotions, adjustments, refunds, error charges, ads and other fees (the CSV has each one). “Net only” means the statement had no breakdown — import the detailed report to split it.</p>
      </section>

      {dep && <DepositDialog b={dep} onClose={() => setDep(null)} onSaved={() => { setMsg('Deposit saved.'); setDep(null); load(); }} />}
    </div>
  );
}

function DepositDialog({ b, onClose, onSaved }: { b: Batch; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(b.deposit ? String(b.deposit.amount) : b.net.toFixed(2));
  const [date, setDate] = useState(b.deposit?.date ?? b.payoutDate ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(b.deposit?.note ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const gap = Number(amount) - b.net;
  async function save() {
    setBusy(true); setErr('');
    try { await api('/api/food-hub/recon/payouts', { method: 'POST', json: { key: b.key, amount: Number(amount), date, note } }); onSaved(); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Bank deposit — ${CH_NAME[b.channel] ?? b.channel} ${b.payoutRef ?? day(b.payoutDate)}`} onClose={onClose}>
      <p className="small">The statement says <strong>{cad(b.net)}</strong>. Enter what your bank statement shows for this payout.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label className="small">Amount received ($)<br /><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="small">Deposit date<br /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="small">Note<br /><input value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%' }} maxLength={200} placeholder="Bank reference…" /></label>
        {Number.isFinite(gap) && Math.abs(gap) >= 0.01 && <div className="fh-banner warn">Differs from the statement by {signed(gap)} — the ledger entry will show a warning.</div>}
        {err && <div className="fh-banner warn">{err}</div>}
        <div className="fh-row" style={{ justifyContent: 'flex-end' }}><button className="btn-light" onClick={onClose}>Cancel</button><button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save deposit'}</button></div>
      </div>
    </Modal>
  );
}
