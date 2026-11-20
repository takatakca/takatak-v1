'use client';

// Disputes — every missing order, short payment, error charge and refund, from "to check" to "recovered" (RC9).
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StatTile } from '@/app/dashboard/food-hub/charts';
import { api, downloadCsv, Modal, useCatalog, useMe } from '@/app/dashboard/food-hub/ui';
import { CASE_STATUS_LABEL, CaseBadge, CH_NAME, FinanceError, FinanceHead, RECOVERABLE, cad, day, type CaseStatus } from '../finance-ui';

type Case = {
  id: string; type: string; channel: string; ref: string; orderId: string | null; brandName: string | null; locationCode: string | null; orderDate: string | null;
  amount: number; status: CaseStatus; platformCaseId?: string; recoveredAmount?: number; notes: Array<{ at: string; by: string; text: string }>; openedAt: string; updatedAt: string; autoClosed?: boolean;
};
const TYPE: Record<string, string> = { short_paid: 'Paid less than expected', missing: 'Missing from payout', error_charge: 'Error charge', refunded: 'Refund / chargeback', unknown_order: 'Paid order not in Food Hub', deposit_gap: 'Deposit differs from statement' };
type Tab = 'active' | 'recovered' | 'closed' | 'all';
const TABS: Array<[Tab, string, CaseStatus[]]> = [
  ['active', 'To do', ['open', 'disputed']], ['recovered', 'Recovered', ['recovered']], ['closed', 'Closed', ['resolved', 'written_off', 'ignored']], ['all', 'All', []],
];
const HOW: Array<[string, string]> = [
  ['Uber Eats', 'Uber Eats Manager → Orders → open the order → report a problem with the payment, or contact merchant support with the order id.'],
  ['DoorDash', 'Merchant Portal → Orders → open the order → dispute the error charge or adjustment. Keep a photo of the order if you have one.'],
  ['SkipTheDishes', 'Restaurant Portal / partner support with the order number and the statement line.'],
  ['Too Good To Go', 'Contact TGTG store support with the payout period and the difference.'],
];

export default function DisputesPage() {
  const { can } = useMe();
  const { locName } = useCatalog();
  const [cases, setCases] = useState<Case[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [channel, setChannel] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<Case | null>(null);

  const load = useCallback(() => api<{ cases: Case[] }>('/api/food-hub/recon/cases').then((d) => { setCases(d.cases); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const statuses = TABS.find(([k]) => k === tab)![2];
  const rows = useMemo(() => cases.filter((c) => (!statuses.length || statuses.includes(c.status)) && (!channel || c.channel === channel)).sort((a, b) => b.amount - a.amount), [cases, statuses, channel]);
  const sum = (f: (c: Case) => boolean, v: (c: Case) => number = (c) => c.amount) => cases.filter(f).reduce((s, c) => s + v(c), 0);
  const owed = (c: Case) => RECOVERABLE.includes(c.type);
  const unknownOpen = cases.filter((c) => c.type === 'unknown_order' && c.status === 'open').length;

  function exportCsv() {
    downloadCsv('takatak-disputes', ['Opened', 'Platform', 'Problem', 'Order', 'Order date', 'Brand', 'Location', 'Amount', 'Status', 'Platform case #', 'Recovered', 'Last note'],
      rows.map((c) => [day(c.openedAt), CH_NAME[c.channel] ?? c.channel, TYPE[c.type] ?? c.type, c.ref, c.orderDate ?? '', c.brandName ?? '', c.locationCode ?? '', c.amount.toFixed(2), CASE_STATUS_LABEL[c.status], c.platformCaseId ?? '', c.recoveredAmount?.toFixed(2) ?? '', c.notes[c.notes.length - 1]?.text ?? '']));
  }

  return (
    <div>
      <FinanceHead title="Disputes" intro="Problems found in the payouts open here by themselves and close by themselves when a later statement pays the order. Mark what you disputed with the platform and what came back — your decisions are never overwritten." />
      <FinanceError message={err} />
      {msg && <div className="fh-banner info" role="status">{msg}</div>}
      <div className="viz-stats">
        <StatTile hero label="To recover — not disputed yet" value={cad(sum((c) => owed(c) && c.status === 'open'))} note={`${cases.filter((c) => owed(c) && c.status === 'open').length} case(s) to dispute with the platforms`} />
        <StatTile label="Disputed, waiting" value={cad(sum((c) => owed(c) && c.status === 'disputed'))} note={`${cases.filter((c) => owed(c) && c.status === 'disputed').length} case(s)`} />
        <StatTile label="Recovered" value={cad(sum((c) => c.status === 'recovered', (c) => c.recoveredAmount ?? c.amount))} note={`${cases.filter((c) => c.status === 'recovered').length} case(s) · ${cad(sum((c) => c.status === 'resolved'))} fixed by later payouts`} />
        <StatTile label="Written off" value={cad(sum((c) => c.status === 'written_off'))} />
        <StatTile label="Paid orders not in Food Hub" value={String(unknownOpen)} note="not money lost — a missed webhook or an unmapped store" />
      </div>
      <div className="fh-filters">
        <div className="fh-tabs" role="tablist" style={{ marginBottom: 0 }}>
          {TABS.map(([k, l, st]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l} ({cases.filter((c) => !st.length || st.includes(c.status)).length})</button>)}
        </div>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Platform">
          <option value="">All platforms</option>
          {Object.entries(CH_NAME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn-sm btn-light" onClick={exportCsv} disabled={!rows.length}>Download CSV</button>
      </div>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="fh-table-wrap">
          <table className="fin-table">
            <thead><tr><th>Opened</th><th>Platform</th><th>Problem</th><th>Order</th><th>Brand · location</th><th className="num">Amount</th><th>Status</th><th>Platform case</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="small">{day(c.openedAt)}</td>
                  <td>{CH_NAME[c.channel] ?? c.channel}</td>
                  <td>{TYPE[c.type] ?? c.type}</td>
                  <td>{c.orderId ? <Link href={`/dashboard/food-hub/orders/${c.orderId}`}>#{c.ref}</Link> : <span className="fh-mono small">{c.ref}</span>}<div className="small">{day(c.orderDate)}</div></td>
                  <td className="small">{c.brandName || c.locationCode ? `${c.brandName ?? '—'} · ${c.locationCode ? locName(c.locationCode) : '—'}` : 'Store not identified'}</td>
                  <td className="num"><strong>{cad(c.amount)}</strong>{c.recoveredAmount !== undefined ? <div className="small fin-good">✓ {cad(c.recoveredAmount)} back</div> : null}</td>
                  <td><CaseBadge status={c.status} /></td>
                  <td className="small">{c.platformCaseId ?? '—'}</td>
                  <td><button className="btn-sm btn-light" onClick={() => setEdit(c)}>{can('finance:edit') ? 'Update' : 'History'}</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="small">{tab === 'active' ? 'Nothing to dispute right now. New problems appear here after each statement import and every day.' : 'No case here.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>How to dispute</h2>
        <div className="fin-help">{HOW.map(([t, d]) => <div key={t}><h3>{t}</h3>{d}</div>)}</div>
        <p className="small">Dispute quickly — platforms only accept disputes for a limited time after the order. Write the platform’s case number here so anyone can follow up.</p>
      </section>

      {edit && <CaseDialog c={edit} canEdit={can('finance:edit')} onClose={() => setEdit(null)} onSaved={(text) => { setEdit(null); setMsg(text); load(); }} />}
    </div>
  );
}

function CaseDialog({ c, canEdit, onClose, onSaved }: { c: Case; canEdit: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [status, setStatus] = useState<CaseStatus>(c.status);
  const [platformCaseId, setPlatformCaseId] = useState(c.platformCaseId ?? '');
  const [recovered, setRecovered] = useState(c.recoveredAmount !== undefined ? String(c.recoveredAmount) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setBusy(true); setErr('');
    try {
      await api('/api/food-hub/recon/cases', { method: 'POST', json: { id: c.id, status: status !== c.status ? status : undefined, note: note || undefined, platformCaseId: platformCaseId && platformCaseId !== c.platformCaseId ? platformCaseId : undefined, recoveredAmount: status === 'recovered' && recovered !== '' ? Number(recovered) : undefined } });
      onSaved(`Case #${c.ref} saved.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`${TYPE[c.type] ?? c.type} — ${CH_NAME[c.channel] ?? c.channel} #${c.ref}`} onClose={onClose}>
      <p><strong>{cad(c.amount)}</strong> <span className="small">· opened {day(c.openedAt)}{c.orderDate ? ` · order of ${day(c.orderDate)}` : ''}</span></p>
      {c.type === 'unknown_order' && <div className="fh-banner info">Not money lost: the platform paid an order Food Hub never received — a missed webhook or a store that is not mapped. Check Food Hub → Stores, then set this case to “Ignored”.</div>}
      {canEdit && (
        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          <label className="small">Status<br />
            <select value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)} style={{ width: '100%' }}>
              {(Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).filter((s) => s !== 'resolved' || c.status === 'resolved').map((s) => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="small">Platform case / ticket number<br /><input value={platformCaseId} onChange={(e) => setPlatformCaseId(e.target.value)} style={{ width: '100%' }} maxLength={80} /></label>
          {status === 'recovered' && <label className="small">Amount recovered ($)<br /><input type="number" step="0.01" min="0" value={recovered} onChange={(e) => setRecovered(e.target.value)} placeholder={c.amount.toFixed(2)} /></label>}
          <label className="small">Note<br /><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%' }} maxLength={500} placeholder="What you sent, who you spoke to…" /></label>
          {err && <div className="fh-banner warn">{err}</div>}
          <div className="fh-row" style={{ justifyContent: 'flex-end' }}><button className="btn-light" onClick={onClose}>Cancel</button><button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button></div>
        </div>
      )}
      <strong className="small">History</strong>
      <ul className="small" style={{ paddingLeft: 18, marginTop: 4 }}>
        {[...c.notes].reverse().map((n, i) => <li key={i}><span className="fh-mono">{new Date(n.at).toLocaleString('en-CA')}</span> · {n.by} — {n.text}</li>)}
      </ul>
    </Modal>
  );
}
