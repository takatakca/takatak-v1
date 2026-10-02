'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChartCard, Columns, CompareLine, compactMoney, fmtInt, fmtMoney, HBars, Heatmap, LineLegend, StatTile, VIZ } from '../charts';
import { api, FilterBar, useCatalog, useFilters } from '../ui';

type Kpi = { value: number; previous: number; change: number };
type Group = { key: string; label: string; sales: number; orders: number; lostOrders: number; lostRevenue: number; prevSales: number; aov: number; share: number; change: number };
type Analytics = {
  range: { from: string; to: string; days: number; previousFrom: string; previousTo: string; timezone: string };
  kpis: Record<string, Kpi>;
  daily: Array<{ date: string; sales: number; orders: number; prevSales: number; prevOrders: number }>;
  byChannel: Group[]; byBrand: Group[]; byLocation: Group[];
  items: Array<{ name: string; brand: string; qty: number; revenue: number; orders: number; prevQty: number; change: number }>;
  lostItems: Array<{ name: string; brand: string; qty: number }>;
  heatmap: number[][];
  aovBuckets: Array<{ label: string; orders: number }>;
  cancellations: { total: number; lostRevenue: number; byWho: Record<string, number>; byStage: Record<string, number>; byChannel: Array<{ channel: string; label: string; count: number }>; reasons: Array<{ reason: string; count: number }> };
  uptime: { overallPct: number; offlineMinutes: number; hoursSetFor: number; stores: Array<{ storeId: string; label: string; brandName: string; location: string; hoursSet: boolean; openMinutes: number; offlineMinutes: number; uptimePct: number }> };
  customers: { identified: number; coveragePct: number; newCustomers: number; repeatCustomers: number; repeatRate: number };
};

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
const mins = (n: number) => (n >= 120 ? `${(n / 60).toFixed(1)} h` : `${Math.round(n)} min`);
const WHO: Record<string, string> = { store: 'Store (you)', platform: 'Platform', customer: 'Customer', unknown: 'Not reported' };
const prettyReason = (r: string) => (/^[a-z_]+$/.test(r) ? (r.charAt(0).toUpperCase() + r.slice(1)).replace(/_/g, ' ') : r);
const STAGE: Record<string, string> = { before_accept: 'Before accepting', after_accept: 'After accepting', unknown: 'Not reported' };

// Analytics (Atlas Analytics): any period vs the previous one, by location, platform and brand.
export default function AnalyticsPage() {
  const { filters, set, query } = useFilters('7d');
  const { brands, activeLocations } = useCatalog();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'sales' | 'orders'>('sales');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Analytics>(`/api/food-hub/analytics?${query}`)
      .then((d) => { if (alive) { setData(d); setError(''); } })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [query]);

  const prevLabel = data ? `${fmtDay(data.range.previousFrom)} – ${fmtDay(new Date(new Date(data.range.previousTo).getTime() - 1).toISOString())}` : 'previous period';
  const linePoints = useMemo(() => (data?.daily ?? []).map((d) => ({ label: d.date, cur: metric === 'sales' ? d.sales : d.orders, prev: metric === 'sales' ? d.prevSales : d.prevOrders })), [data, metric]);

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => undefined);
  }

  const k = data?.kpis;
  const groupTable = (rows: Group[], name: string) => ({
    columns: [name, 'Sales', 'Orders', 'Avg order', 'Share %', 'vs prev %', 'Cancelled', 'Lost revenue'],
    rows: rows.map((g) => [g.label, fmtMoney(g.sales), g.orders, fmtMoney(g.aov), `${g.share}%`, `${g.change > 0 ? '+' : ''}${g.change}%`, g.lostOrders, fmtMoney(g.lostRevenue)]),
    filename: `takatak-sales-by-${name.toLowerCase()}`,
  });
  const groupBars = (rows: Group[]) => rows.map((g) => ({ label: g.label, value: g.sales, detail: `${g.orders} orders · ${g.share}% of sales · ${g.change > 0 ? '+' : ''}${g.change}% vs previous` }));

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Analytics</h1>
          <div className="small">Every number compares the selected period with the period just before it (same length). Cancelled orders are counted as lost, not as sales.</div>
        </div>
        <div className="fh-row">
          <button className="btn-light" onClick={copyLink}>{copied ? 'Link copied' : 'Copy link'}</button>
          <a className="button btn-light" href={`/api/food-hub/reports/order_transactions?format=xlsx&${query}`}>Orders (Excel)</a>
        </div>
      </div>
      <FilterBar filters={filters} set={set} brands={brands.filter((b) => b.active).map((b) => b.name)} locations={activeLocations} />
      {error && <div className="fh-banner warn">Could not load analytics: {error}</div>}
      {!data && !error && <p className="small">Loading…</p>}

      {data && k && (
        <div className={loading ? 'viz-loading' : ''}>
          <div className="viz-stats">
            <StatTile hero label="Sales" value={fmtMoney(k.sales.value)} change={k.sales.change} previous={fmtMoney(k.sales.previous)} />
            <StatTile label="Orders" value={fmtInt(k.orders.value)} change={k.orders.change} previous={fmtInt(k.orders.previous)} />
            <StatTile label="Average order" value={fmtMoney(k.aov.value)} change={k.aov.change} previous={fmtMoney(k.aov.previous)} />
            <StatTile label="Lost revenue (cancelled)" value={fmtMoney(k.lostRevenue.value)} change={k.lostRevenue.change} previous={fmtMoney(k.lostRevenue.previous)} upIsGood={false} note={`${k.lostOrders.value} orders · ${k.cancelRate.value}% of all`} />
            <StatTile label="Time to accept (avg)" value={mins(k.avgAcceptMin.value)} change={k.avgAcceptMin.change} previous={mins(k.avgAcceptMin.previous)} upIsGood={false} note={`${k.autoAcceptRate.value}% auto-accepted`} />
            <StatTile label="Prep time (avg)" value={k.avgPrepMin.value ? mins(k.avgPrepMin.value) : '—'} change={k.avgPrepMin.value ? k.avgPrepMin.change : undefined} previous={mins(k.avgPrepMin.previous)} upIsGood={false} note="accept → marked ready" />
            <StatTile label="Store uptime in open hours" value={`${data.uptime.overallPct}%`} note={`${mins(data.uptime.offlineMinutes)} offline · hours set for ${data.uptime.hoursSetFor}/${data.uptime.stores.length} stores`} />
            <StatTile label="Reached Clover" value={`${k.cloverRate.value}%`} change={k.cloverRate.change} previous={`${k.cloverRate.previous}%`} />
          </div>

          <ChartCard
            title={metric === 'sales' ? 'Sales per day' : 'Orders per day'}
            subtitle={`${fmtDay(data.range.from)} – ${fmtDay(new Date(new Date(data.range.to).getTime() - 1).toISOString())} vs ${prevLabel}`}
            legend={<>
              <LineLegend items={[{ label: 'This period', color: VIZ.series }, { label: 'Previous period', color: VIZ.compare, dash: true }]} />
              <span className="viz-switch" role="group" aria-label="Metric">
                <button className={metric === 'sales' ? 'on' : ''} aria-pressed={metric === 'sales'} onClick={() => setMetric('sales')}>Sales</button>
                <button className={metric === 'orders' ? 'on' : ''} aria-pressed={metric === 'orders'} onClick={() => setMetric('orders')}>Orders</button>
              </span>
            </>}
            table={{ columns: ['Date', 'Sales', 'Orders', 'Previous sales', 'Previous orders'], rows: data.daily.map((d) => [d.date, fmtMoney(d.sales), d.orders, fmtMoney(d.prevSales), d.prevOrders]), filename: 'takatak-daily' }}
          >
            {data.daily.length < 2
              ? <div className="viz-empty">One day selected — {metric === 'sales' ? fmtMoney(data.daily[0]?.sales ?? 0) : `${data.daily[0]?.orders ?? 0} orders`} vs {metric === 'sales' ? fmtMoney(data.daily[0]?.prevSales ?? 0) : `${data.daily[0]?.prevOrders ?? 0} orders`} the day before. Pick 2 or more days to see the trend.</div>
              : <CompareLine points={linePoints} curLabel="This period" prevLabel="Previous period" format={metric === 'sales' ? fmtMoney : (n) => `${fmtInt(n)} orders`} axisFormat={metric === 'sales' ? compactMoney : fmtInt} />}
          </ChartCard>

          <div className="viz-grid2">
            <ChartCard title="Sales by platform" table={groupTable(data.byChannel, 'Platform')}><HBars rows={groupBars(data.byChannel)} format={fmtMoney} /></ChartCard>
            <ChartCard title="Sales by location" table={groupTable(data.byLocation, 'Location')}><HBars rows={groupBars(data.byLocation)} format={fmtMoney} /></ChartCard>
          </div>
          <ChartCard title="Sales by brand" subtitle={`${data.byBrand.length} brands with orders`} table={groupTable(data.byBrand, 'Brand')}><HBars rows={groupBars(data.byBrand)} format={fmtMoney} /></ChartCard>

          <div className="viz-grid2">
            <ChartCard title="Busiest hours" subtitle="Orders by day of week and hour (Montréal time)"
              table={{ columns: ['Day', ...Array.from({ length: 24 }, (_, h) => `${h}h`)], rows: data.heatmap.map((r, d) => [['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d], ...r]), filename: 'takatak-busy-hours' }}>
              <Heatmap grid={data.heatmap} />
            </ChartCard>
            <ChartCard title="Order size" subtitle="How many orders fall in each total range" table={{ columns: ['Order total', 'Orders'], rows: data.aovBuckets.map((b) => [b.label, b.orders]), filename: 'takatak-order-size' }}>
              <Columns rows={data.aovBuckets.map((b) => ({ label: b.label, value: b.orders }))} format={fmtInt} />
            </ChartCard>
          </div>

          <div className="viz-grid2">
            <ChartCard title="Cancellations — who cancelled" subtitle={`${data.cancellations.total} orders · ${fmtMoney(data.cancellations.lostRevenue)} lost`}
              table={{ columns: ['Who', 'Orders'], rows: Object.entries(data.cancellations.byWho).map(([w, n]) => [WHO[w] ?? w, n]), filename: 'takatak-cancellations-who' }}>
              <HBars rows={Object.entries(data.cancellations.byWho).filter(([, n]) => n > 0).map(([w, n]) => ({ label: WHO[w] ?? w, value: n, detail: 'cancelled orders' }))} format={fmtInt} empty="No cancellations in this period." />
              {data.cancellations.total > 0 && (
                <div className="small" style={{ marginTop: 10 }}>
                  {Object.entries(data.cancellations.byStage).filter(([, n]) => n > 0).map(([s, n]) => `${STAGE[s] ?? s}: ${n}`).join(' · ')}
                </div>
              )}
            </ChartCard>
            <ChartCard title="Cancellation reasons" table={{ columns: ['Reason', 'Orders'], rows: data.cancellations.reasons.map((r) => [prettyReason(r.reason), r.count]), filename: 'takatak-cancel-reasons' }}>
              <HBars rows={data.cancellations.reasons.map((r) => ({ label: prettyReason(r.reason), value: r.count, detail: 'orders' }))} format={fmtInt} empty="No cancellations in this period." />
            </ChartCard>
          </div>

          <ChartCard title="Top items" subtitle="By revenue, with the change in quantity vs the previous period"
            table={{ columns: ['Item', 'Brand', 'Qty', 'Revenue', 'Orders', 'Qty vs prev %'], rows: data.items.map((i) => [i.name, i.brand, i.qty, fmtMoney(i.revenue), i.orders, `${i.change > 0 ? '+' : ''}${i.change}%`]), filename: 'takatak-top-items' }}>
            <HBars rows={data.items.slice(0, 15).map((i) => ({ label: `${i.name}${i.brand ? ` · ${i.brand}` : ''}`, value: i.revenue, detail: `${i.qty} sold · ${i.change > 0 ? '+' : ''}${i.change}% qty vs previous` }))} format={fmtMoney} />
            {data.lostItems.length > 0 && <p className="small" style={{ marginTop: 10 }}>Most in cancelled orders: {data.lostItems.slice(0, 5).map((i) => `${i.name} (${i.qty})`).join(', ')}</p>}
          </ChartCard>

          <div className="viz-grid2">
            <ChartCard title="Store uptime during opening hours" subtitle="Lowest first — offline time while the store should have been open"
              table={{ columns: ['Platform', 'Brand', 'Location', 'Hours set', 'Open (min)', 'Offline (min)', 'Uptime %'], rows: data.uptime.stores.map((u) => [u.label, u.brandName, u.location, u.hoursSet ? 'yes' : 'no (24/7 assumed)', u.openMinutes, u.offlineMinutes, `${u.uptimePct}%`]), filename: 'takatak-uptime' }}>
              <HBars rows={data.uptime.stores.slice(0, 12).map((u) => ({ label: `${u.label} · ${u.brandName} · ${u.location}`, value: u.uptimePct, detail: `${mins(u.offlineMinutes)} offline of ${mins(u.openMinutes)} open` }))} format={(n) => `${n}%`} empty="No stores mapped yet." />
            </ChartCard>
            <ChartCard title="Customers" subtitle="Only where the platform shares a customer id"
              table={{ columns: ['Measure', 'Value'], rows: [['Customers identified', data.customers.identified], ['Orders with a customer id', `${data.customers.coveragePct}%`], ['New customers', data.customers.newCustomers], ['Returning customers', data.customers.repeatCustomers], ['Returning rate', `${data.customers.repeatRate}%`]], filename: 'takatak-customers' }}>
              <div className="viz-stats" style={{ marginBottom: 0 }}>
                <StatTile label="New customers" value={fmtInt(data.customers.newCustomers)} />
                <StatTile label="Returning customers" value={fmtInt(data.customers.repeatCustomers)} note={`${data.customers.repeatRate}% of identified`} />
              </div>
              <p className="small">Customer ids were available on {data.customers.coveragePct}% of orders. Returning = ordered before (last 90 days) or more than once in this period.</p>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
