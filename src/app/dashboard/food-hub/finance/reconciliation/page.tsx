'use client';

// Orders vs payouts — every order, what it should have paid and what it did pay (RC9).
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { api, downloadCsv, STATUS_LABEL, useCatalog, useFilters } from '@/app/dashboard/food-hub/ui';
import { CaseBadge, CH_NAME, FinanceError, FinanceFilters, FinanceHead, PROBLEM, RECON_LABEL, ReconBadge, cad, day, signed, toRecover, type OrderRecon, type Recon, type ReconStatus, type Unmatched } from '../finance-ui';

type View = 'problems' | 'all' | 'matched' | 'waiting' | 'statement';
const VIEWS: Array<[View, string]> = [['problems', 'Problems'], ['all', 'All orders'], ['matched', 'Paid as expected'], ['waiting', 'Not due / no statement'], ['statement', 'Only on statements']];
const inView = (v: View, s: ReconStatus) => v === 'all' || (v === 'problems' && PROBLEM.includes(s)) || (v === 'matched' && (s === 'matched' || s === 'cancelled')) || (v === 'waiting' && (s === 'pending' || s === 'not_covered'));
const KIND: Record<string, string> = { order: 'Order', refund: 'Refund', adjustment: 'Adjustment', error_charge: 'Error charge', promotion: 'Promotion', ads: 'Ads', fee: 'Fee', other: 'Other' };
const PAGE = 300;

export default function ReconciliationPage() {
  const { filters, set, query } = useFilters('30d');
  const { activeLocations, locName } = useCatalog();
  const [view, setView] = useState<View>('problems');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<Recon | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => { const v = new URLSearchParams(window.location.search).get('view') as View | null; if (v && VIEWS.some(([k]) => k === v)) setView(v); }, []);
  const load = useCallback(() => api<Recon>(`/api/food-hub/recon?${query}`).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message)), [query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setLimit(PAGE); }, [view, search, query]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return (data?.orders ?? [])
      .filter((o) => inView(view, o.status))
      .filter((o) => !q || o.displayId.toLowerCase().includes(q) || o.ref.toLowerCase().includes(q) || (o.brandName ?? '').toLowerCase().includes(q))
      .sort((a, b) => (view === 'problems' ? toRecover(b) - toRecover(a) : 0) || b.date.localeCompare(a.date));
  }, [data, view, search]);
  const count = (v: View) => (v === 'statement' ? (data?.unmatched.length ?? 0) + (data?.other.length ?? 0) : (data?.orders ?? []).filter((o) => inView(v, o.status)).length);

  function exportCsv() {
    downloadCsv(`orders-vs-payouts-${filters.from}-${filters.to}`,
      ['Date', 'Platform', 'Order', 'Platform order id', 'Brand', 'Location', 'Fulfillment', 'Customer paid', 'Food sales', 'Tax', 'Commission %', 'Commission', 'Tax on commission', 'Fixed fee', 'Expected payout', 'Paid', 'Difference', 'To recover', 'Status', 'Payout date'],
      rows.map((o) => [day(o.date), CH_NAME[o.channel] ?? o.channel, o.displayId, o.ref, o.brandName ?? '', o.locationCode ?? '', o.fulfillment, o.total.toFixed(2), o.expected.sales.toFixed(2), o.expected.tax.toFixed(2), o.expected.ratePct, o.expected.commission.toFixed(2), o.expected.commissionTax.toFixed(2), o.expected.fixedFee.toFixed(2), o.expected.net.toFixed(2), o.actual?.toFixed(2) ?? '', o.diff?.toFixed(2) ?? '', toRecover(o).toFixed(2), RECON_LABEL[o.status], o.payoutDate ?? '']));
  }

  return (
    <div>
      <FinanceHead title="Orders vs payouts" intro="Each accepted order with its expected payout (customer price − commission − tax on commission) next to what the platform's statement paid. Click an order to see the calculation." />
      <FinanceError message={err} />
      <FinanceFilters filters={filters} set={set} locations={activeLocations} extra={<>
        <input type="search" placeholder="Order # or brand" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search orders" />
        <button className="btn-sm btn-light" onClick={exportCsv} disabled={!rows.length}>Download CSV</button>
      </>} />
      <div className="fh-tabs" role="tablist">
        {VIEWS.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l} ({count(k)})</button>)}
      </div>

      {view === 'statement' ? <StatementOnly data={data} /> : (
        <section className="card">
          <div className="fh-table-wrap">
            <table className="fin-table">
              <thead><tr><th>Date</th><th>Platform</th><th>Order</th><th>Brand · location</th><th className="num">Customer paid</th><th className="num">Expected</th><th className="num">Paid</th><th className="num">Difference</th><th>Status</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((o) => (
                  <Fragment key={o.orderId}>
                    <tr className={`fin-row ${open === o.orderId ? 'fin-open' : ''}`} onClick={() => setOpen(open === o.orderId ? null : o.orderId)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(open === o.orderId ? null : o.orderId); }} aria-expanded={open === o.orderId}>
                      <td>{day(o.date)}</td>
                      <td>{CH_NAME[o.channel] ?? o.channel}</td>
                      <td>#{o.displayId}</td>
                      <td className="small">{o.brandName ?? '—'} · {locName(o.locationCode)}</td>
                      <td className="num">{cad(o.total)}</td>
                      <td className="num">{cad(o.expected.net)}</td>
                      <td className="num">{cad(o.actual)}</td>
                      <td className="num">{signed(o.diff)}</td>
                      <td><ReconBadge status={o.status} /></td>
                    </tr>
                    {open === o.orderId && <tr className="fin-open"><td colSpan={9}><Detail o={o} /></td></tr>}
                  </Fragment>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} className="small">{data ? 'No order in this view.' : 'Loading…'}</td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > limit && <button className="btn-sm btn-light" style={{ marginTop: 10 }} onClick={() => setLimit(limit + PAGE)}>Show more ({rows.length - limit} left)</button>}
        </section>
      )}
    </div>
  );
}

function Detail({ o }: { o: OrderRecon }) {
  const e = o.expected;
  return (
    <div className="fin-detail">
      <div>
        <strong>Expected payout</strong>
        <div className="fin-calc" style={{ marginTop: 6 }}>
          <span>Food sales (after your promotions)</span><span>{cad(e.sales)}</span>
          <span>+ Sales tax passed through (GST + QST)</span><span>{cad(e.tax)}</span>
          <span>− Commission {e.ratePct}% ({o.fulfillment === 'pickup' ? 'pickup' : 'delivery'})</span><span>−{cad(e.commission)}</span>
          <span>− Tax on commission (recoverable)</span><span>−{cad(e.commissionTax)}</span>
          {e.fixedFee ? <><span>− Fixed fee per order</span><span>−{cad(e.fixedFee)}</span></> : null}
          <span className="tot">Expected</span><span className="tot">{cad(e.net)}</span>
        </div>
        {!o.planConfirmed && <p className="small">Uses the published rate card — <Link href="/dashboard/food-hub/finance/fees">confirm your plan</Link>.</p>}
      </div>
      <div>
        <strong>What the statement says</strong>
        <div className="fin-calc" style={{ marginTop: 6 }}>
          <span>Statement lines</span><span>{o.lines}</span>
          <span>Paid (net)</span><span>{cad(o.actual)}</span>
          {o.refunds ? <><span>Refunds / chargebacks</span><span>{cad(o.refunds)}</span></> : null}
          {o.errorCharges ? <><span>Error charges</span><span>{cad(o.errorCharges)}</span></> : null}
          {o.adjustments ? <><span>Adjustments</span><span>{cad(o.adjustments)}</span></> : null}
          <span>Payout date</span><span>{day(o.payoutDate)}</span>
          <span className="tot">Difference</span><span className="tot">{signed(o.diff)}</span>
        </div>
        <p className="small">{explain(o)}</p>
      </div>
      <div>
        <strong>Order</strong>
        <dl className="fh-kv" style={{ marginTop: 6 }}>
          <dt>Platform id</dt><dd className="fh-mono small">{o.ref}</dd>
          <dt>Status</dt><dd>{STATUS_LABEL[o.orderStatus] ?? o.orderStatus}</dd>{o.caseStatus && <><dt>Dispute</dt><dd><CaseBadge status={o.caseStatus} /></dd></>}
          <dt>Customer paid</dt><dd>{cad(o.total)}</dd>
        </dl>
        <p><Link href={`/dashboard/food-hub/orders/${o.orderId}`}>Open the order →</Link>{toRecover(o) >= 1 && <> · <Link href="/dashboard/food-hub/finance/disputes">Dispute ({cad(toRecover(o))}) →</Link></>}</p>
      </div>
    </div>
  );
}

function explain(o: OrderRecon) {
  switch (o.status) {
    case 'matched': return 'The platform paid what your plan says it should.';
    case 'missing': return 'This order is inside a period covered by an imported statement, but no line pays it. Dispute it with the platform.';
    case 'short_paid': return 'Paid less than expected — check the commission plan first, then dispute the difference.';
    case 'over_paid': return 'Paid more than expected — often a promotion the platform funded, or a different commission rate on this store.';
    case 'refunded': return 'The platform refunded the customer and took the money back from you. Dispute it if the food was correct.';
    case 'error_charge': return 'The platform charged you for an error (missing item, wrong order…). Dispute it if the order was right.';
    case 'pending': return 'The platform has not paid this order yet — it is still inside the normal payout delay.';
    case 'not_covered': return 'No statement imported for this date yet. Import the statement to check it.';
    case 'cancelled': return 'Cancelled — nothing is due.';
    default: return '';
  }
}

function StatementTable({ rows, empty }: { rows: Unmatched[]; empty: string }) {
  return (
    <div className="fh-table-wrap">
      <table className="fin-table">
        <thead><tr><th>Platform</th><th>Order date</th><th>Payout date</th><th>Reference</th><th>Type</th><th>Description</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}><td>{CH_NAME[l.channel] ?? l.channel}</td><td>{day(l.orderDate)}</td><td>{day(l.payoutDate)}</td><td className="fh-mono small">{l.ref ?? '—'}</td><td>{KIND[l.kind] ?? l.kind}</td><td className="small" style={{ whiteSpace: 'normal' }}>{l.description || '—'}</td><td className="num">{signed(l.net)}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="small">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function StatementOnly({ data }: { data: Recon | null }) {
  return (
    <>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Paid orders Food Hub never received</h2>
        <p className="small">The platform paid these orders but Food Hub has no order with that number: a webhook was missed, or the store is not connected to Food Hub yet. Check the store mapping in Channels &amp; Setup.</p>
        <StatementTable rows={data?.unmatched ?? []} empty="None — every paid order on the statements is in Food Hub." />
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Charges and credits without an order</h2>
        <p className="small">Ads, tablet fees, monthly fees, adjustments and credits that are not tied to one order. They go to the internal ledger under “Ads &amp; other platform charges”.</p>
        <StatementTable rows={data?.other ?? []} empty="None in this period." />
      </section>
    </>
  );
}
