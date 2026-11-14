'use client';

// Payouts & Reconciliation — "where is my money?" (RC9)
// Every order the platforms sent × the commission plan × what their statements actually paid.
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChartCard, HBars, StatTile, fmtInt } from '@/app/dashboard/food-hub/charts';
import { api, useCatalog, useFilters, useMe } from '@/app/dashboard/food-hub/ui';
import { CaseBadge, CH_NAME, FinanceError, FinanceFilters, FinanceHead, PROBLEM, RECON_LABEL, RECOVERABLE, ReconBadge, cad, day, signed, toRecover, type Recon, type ReconStatus } from './finance-ui';

export default function FinanceOverview() {
  const { filters, set, query } = useFilters('30d');
  const { activeLocations, locName } = useCatalog();
  const { can } = useMe();
  const [data, setData] = useState<Recon | null>(null);
  const [openCases, setOpenCases] = useState<{ count: number; amount: number } | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api<Recon>(`/api/food-hub/recon?${query}`),
        api<{ cases: Array<{ amount: number; status: string; type: string }> }>('/api/food-hub/recon/cases?status=open,disputed'),
      ]);
      const owed = c.cases.filter((x) => RECOVERABLE.includes(x.type));
      setData(r); setOpenCases({ count: owed.length, amount: owed.reduce((s, x) => s + x.amount, 0) }); setErr('');
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }, [query]);
  useEffect(() => { load(); }, [load]);

  async function recheck() {
    setBusy(true); setMsg('');
    try {
      const r = await api<{ opened: number; closed: number }>('/api/food-hub/recon/run', { method: 'POST' });
      setMsg(`Re-checked the last 90 days: ${r.opened} new problem(s) to check, ${r.closed} fixed by later payouts.`);
      await load();
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  const problems = useMemo(() => (data?.orders ?? []).filter((o) => PROBLEM.includes(o.status)).sort((a, b) => toRecover(b) - toRecover(a)), [data]);
  const unconfirmed = (data?.channels ?? []).filter((c) => c.orders > 0 && !c.planConfirmed);
  const statusRows = useMemo(() => {
    const counts = new Map<ReconStatus, number>();
    for (const o of data?.orders ?? []) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ label: RECON_LABEL[s], value: n }));
  }, [data]);
  const recoverRows = (data?.channels ?? []).filter((c) => c.orders || c.unknownOrders).map((c) => ({ label: c.label, value: c.missingMoney, detail: `${c.counts.missing} missing · ${c.counts.short_paid + c.counts.error_charge + c.counts.refunded} paid less` }));

  return (
    <div>
      <FinanceHead
        title="Payouts & Reconciliation"
        intro="Where is my money? Every order Uber Eats, DoorDash, SkipTheDishes and Too Good To Go sent you is checked against your commission plan and against what their statements actually paid. Missing orders, short payments, error charges and refunds become dispute cases automatically. Nothing is ever posted or approved for you."
        right={<>
          <Link className="button btn-sm btn-light" href="/dashboard/food-hub/finance/imports">Import a statement</Link>
          {can('finance:edit') && <button className="btn-sm" disabled={busy} onClick={recheck}>{busy ? 'Checking…' : 'Re-check now'}</button>}
        </>}
      />
      <FinanceError message={err} />
      {msg && <div className="fh-banner info" role="status">{msg}</div>}
      <FinanceFilters filters={filters} set={set} locations={activeLocations} />

      {data && data.imports === 0 && (
        <div className="fh-banner info">No payout statement imported yet — expected payouts are calculated, but nothing can be marked missing or short-paid until you <Link href="/dashboard/food-hub/finance/imports">import a statement</Link> (Uber Eats can also send its report automatically).</div>
      )}
      {unconfirmed.length > 0 && (
        <div className="fh-banner warn">Commission plan not confirmed for {unconfirmed.map((c) => c.label).join(', ')} — expected payouts use the published rate card. <Link href="/dashboard/food-hub/finance/fees">Check your plans</Link> so differences are real.</div>
      )}

      {data && (
        <>
          <div className="viz-stats">
            <StatTile hero label="Money to recover" value={cad(data.totals.missingMoney)} note={`${problems.filter((o) => toRecover(o) > 0).length} order(s) still to chase · ${openCases?.count ?? 0} open case(s)`} />
            <StatTile label="Paid by the platforms" value={cad(data.totals.paid)} note="orders found in statements" />
            <StatTile label="Expected for those orders" value={cad(data.totals.expected)} note="after commission and tax on fees" />
            <StatTile label="Difference" value={signed(data.totals.diff)} note="paid − expected" />
            <StatTile label="Paid orders not in Food Hub" value={fmtInt(data.totals.unknownOrders)} note="missed webhooks or unconnected stores" />
            <StatTile label="Other charges & credits" value={signed(data.totals.otherCharges)} note="ads, tablet fees, adjustments" />
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="fh-head" style={{ marginBottom: 10 }}><h2 style={{ margin: 0, fontSize: 17 }}>By platform</h2><span className="small">Checked {new Date(data.generatedAt).toLocaleString('en-CA')}</span></div>
            <div className="fh-table-wrap">
              <table className="fin-table">
                <thead><tr><th>Platform</th><th className="num">Orders</th><th className="num">Sales</th><th className="num">Expected</th><th className="num">Paid</th><th className="num">Diff.</th><th className="num">To recover</th><th>Problems</th><th>Statements to</th><th>Plan</th></tr></thead>
                <tbody>
                  {data.channels.map((c) => {
                    const prob = PROBLEM.reduce((s, k) => s + (c.counts[k] ?? 0), 0);
                    return (
                      <tr key={c.channel}>
                        <td><strong>{c.label}</strong></td>
                        <td className="num">{fmtInt(c.orders)}</td>
                        <td className="num">{cad(c.sales)}</td>
                        <td className="num">{cad(c.expected)}</td>
                        <td className="num">{cad(c.paid)}</td>
                        <td className="num">{signed(c.diff)}</td>
                        <td className="num">{c.missingMoney ? <span className="fin-bad">{cad(c.missingMoney)}</span> : cad(0)}</td>
                        <td>{prob ? <Link href={`/dashboard/food-hub/finance/reconciliation?channels=${c.channel}&view=problems`}>{prob} order(s)</Link> : <span className="small">none</span>}{c.unknownOrders ? <span className="small"> · {c.unknownOrders} unknown</span> : null}</td>
                        <td className="small">{c.coveredUntil ? day(c.coveredUntil) : 'none imported'}</td>
                        <td>{c.planConfirmed ? <span className="badge badge-green" title="Matches your contract">✓ OK</span> : <Link className="badge badge-yellow" href="/dashboard/food-hub/finance/fees" title="Confirm the commission plan">? Check</Link>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="viz-grid2" style={{ marginBottom: 16 }}>
            <ChartCard title="Money to recover by platform" subtitle="Missing orders plus amounts paid less than expected" table={{ columns: ['Platform', 'To recover ($)', 'Detail'], rows: recoverRows.map((r) => [r.label, r.value.toFixed(2), r.detail]), filename: 'money-to-recover' }}>
              <HBars rows={recoverRows} format={cad} empty="Nothing to recover for this period." />
            </ChartCard>
            <ChartCard title="Orders by payout status" subtitle={`${fmtInt(data.totals.orders)} accepted orders in the period`} table={{ columns: ['Status', 'Orders'], rows: statusRows.map((r) => [r.label, r.value]), filename: 'orders-by-payout-status' }}>
              <HBars rows={statusRows} format={fmtInt} empty="No orders in this period." />
            </ChartCard>
          </div>

          <section className="card" style={{ marginBottom: 16 }}>
            <div className="fh-head" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Biggest problems</h2>
              <div className="fh-row"><Link href="/dashboard/food-hub/finance/reconciliation?view=problems">All orders vs payouts →</Link><Link href="/dashboard/food-hub/finance/disputes">Disputes{openCases ? ` (${openCases.count} open · ${cad(openCases.amount)})` : ''} →</Link></div>
            </div>
            {problems.length === 0 ? <p className="small">No missing or short-paid order in this period{data.imports ? '' : ' (import statements to check payouts)'}.</p> : (
              <div className="fh-table-wrap">
                <table className="fin-table">
                  <thead><tr><th>Date</th><th>Platform</th><th>Order</th><th>Brand · location</th><th className="num">Expected</th><th className="num">Paid</th><th className="num">To recover</th><th>Status</th><th>Dispute</th></tr></thead>
                  <tbody>
                    {problems.slice(0, 10).map((o) => (
                      <tr key={o.orderId}>
                        <td>{day(o.date)}</td>
                        <td>{CH_NAME[o.channel] ?? o.channel}</td>
                        <td><Link href={`/dashboard/food-hub/orders/${o.orderId}`}>#{o.displayId}</Link></td>
                        <td className="small">{o.brandName ?? '—'} · {locName(o.locationCode)}</td>
                        <td className="num">{cad(o.expected.net)}</td>
                        <td className="num">{cad(o.actual)}</td>
                        <td className="num">{toRecover(o) ? <span className="fin-bad">{cad(toRecover(o))}</span> : '—'}</td>
                        <td><ReconBadge status={o.status} /></td>
                        <td>{o.caseStatus ? <CaseBadge status={o.caseStatus} /> : <span className="small">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {(data.unmatched.length > 0 || data.other.length > 0) && (
            <section className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ marginTop: 0, fontSize: 17 }}>On the statements but not in Food Hub</h2>
              <p className="small">{data.unmatched.length} paid order line(s) with an order number Food Hub never received, and {data.other.length} line(s) without an order (ads, tablet fees, adjustments). <Link href="/dashboard/food-hub/finance/reconciliation?view=statement">Review them →</Link></p>
            </section>
          )}
        </>
      )}
      {!data && !err && <p className="small">Loading…</p>}
    </div>
  );
}
