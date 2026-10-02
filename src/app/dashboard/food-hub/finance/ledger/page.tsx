'use client';

// Internal ledger — one balanced journal entry per payout, drafted automatically, approved by the owner (RC9).
// Approval only marks an entry as reviewed: nothing is posted to QuickBooks or anywhere else.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, useCatalog, useFilters, useMe } from '@/app/dashboard/food-hub/ui';
import { CH_NAME, FinanceError, FinanceFilters, FinanceHead, cad, day } from '../finance-ui';

type Line = { account: string; debit: number; credit: number; memo?: string };
type Entry = { key: string; date: string | null; channel: string; memo: string; lines: Line[]; debit: number; credit: number; balanced: boolean; status: 'draft' | 'approved'; approvedBy?: string; approvedAt?: string; warnings: string[] };
type Tab = 'draft' | 'approved' | 'all';

export default function LedgerPage() {
  const { filters, set, query } = useFilters('last_month');
  const { activeLocations } = useCatalog();
  const { can } = useMe();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tab, setTab] = useState<Tab>('draft');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => api<{ entries: Entry[] }>(`/api/food-hub/recon/ledger?${query}`).then((d) => { setEntries(d.entries); setErr(''); setLoaded(true); }).catch((e) => setErr(e.message)), [query]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => entries.filter((e) => tab === 'all' || e.status === tab), [entries, tab]);
  const byAccount = useMemo(() => {
    const m = new Map<string, { debit: number; credit: number }>();
    for (const e of entries) for (const l of e.lines) { const a = m.get(l.account) ?? { debit: 0, credit: 0 }; a.debit += l.debit; a.credit += l.credit; m.set(l.account, a); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  async function approve(e: Entry) {
    if (e.warnings.length && !window.confirm(`${e.warnings.join('\n')}\n\nApprove anyway?`)) return;
    setBusy(e.key); setMsg('');
    try { await api('/api/food-hub/recon/ledger', { method: 'POST', json: { key: e.key } }); setMsg(`Approved: ${e.memo}`); await load(); }
    catch (x) { setMsg(x instanceof Error ? x.message : String(x)); } finally { setBusy(null); }
  }

  const csvHref = `/api/food-hub/recon/ledger?format=csv&${query}`;
  return (
    <div>
      <FinanceHead title="Internal ledger" intro="The TAKATAK internal ledger: one journal entry per payout — bank deposit, delivery sales, GST and QST collected, commissions, tax on fees (input tax credits), promotions, refunds and other charges. Entries are drafts until you approve them. Nothing is posted to QuickBooks or anywhere else; download the CSV for your accountant."
        right={<a className="button btn-sm btn-light" href={csvHref}>Download CSV</a>} />
      <FinanceError message={err} />
      {msg && <div className="fh-banner info" role="status">{msg}</div>}
      <FinanceFilters filters={filters} set={set} locations={activeLocations} showLocations={false} extra={
        <div className="fh-tabs" role="tablist" style={{ marginBottom: 0 }}>
          {([['draft', 'To approve'], ['approved', 'Approved'], ['all', 'All']] as Array<[Tab, string]>).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} ({entries.filter((e) => k === 'all' || e.status === k).length})</button>)}
        </div>} />

      {rows.map((e) => (
        <div key={e.key} className="fin-entry">
          <div className="fh-head" style={{ marginBottom: 6 }}>
            <div>
              <strong>{e.memo}</strong>
              <div className="small">{day(e.date)} · {CH_NAME[e.channel] ?? e.channel}</div>
            </div>
            <div className="fh-row">
              {e.balanced ? <span className="badge badge-green">✓ Balanced</span> : <span className="badge badge-red">✕ Does not balance</span>}
              {e.status === 'approved'
                ? <span className="badge badge-blue">✓ Approved by {e.approvedBy}{e.approvedAt ? ` · ${day(e.approvedAt)}` : ''}</span>
                : can('finance:edit') && <button className="btn-sm" disabled={!e.balanced || busy === e.key} onClick={() => approve(e)}>{busy === e.key ? 'Approving…' : 'Approve'}</button>}
            </div>
          </div>
          {e.warnings.map((w, i) => <div key={i} className="fh-banner warn" style={{ marginBottom: 6 }}>{w}</div>)}
          <div className="fh-table-wrap">
            <table className="fin-table">
              <thead><tr><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th>Memo</th></tr></thead>
              <tbody>
                {e.lines.map((l, i) => <tr key={i}><td>{l.account}</td><td className="num">{l.debit ? cad(l.debit) : ''}</td><td className="num">{l.credit ? cad(l.credit) : ''}</td><td className="small">{l.memo ?? ''}</td></tr>)}
                <tr><td><strong>Total</strong></td><td className="num"><strong>{cad(e.debit)}</strong></td><td className="num"><strong>{cad(e.credit)}</strong></td><td /></tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {rows.length === 0 && <section className="card"><p className="small" style={{ margin: 0 }}>{!loaded ? 'Loading…' : tab === 'draft' ? 'Nothing to approve in this period. Entries appear when statements are imported.' : 'No entry here.'}</p></section>}

      {byAccount.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Totals by account (period)</h2>
          <div className="fh-table-wrap">
            <table className="fin-table">
              <thead><tr><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
              <tbody>{byAccount.map(([a, v]) => <tr key={a}><td>{a}</td><td className="num">{cad(v.debit)}</td><td className="num">{cad(v.credit)}</td><td className="num">{cad(v.debit - v.credit)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="small">GST/QST collected (2310, 2320) minus input tax credits (1310, 1320) is what the platforms’ sales add to your GST/QST return. Check with your accountant.</p>
        </section>
      )}
    </div>
  );
}
