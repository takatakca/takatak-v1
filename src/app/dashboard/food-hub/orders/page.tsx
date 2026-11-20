'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, FilterBar, fmtTime, Marketplace, ModeBanner, money, STATUS_LABEL, useCatalog, useFilters } from '../ui';

type Order = {
  id: string; channel: string; marketplace: string; externalOrderId: string; displayId?: string; brandName?: string; locationCode?: string;
  customerName?: string; fulfillment: string; status: string; total: number; createdAt: string; posOrderId?: string; posError?: string;
  lines: Array<{ quantity: number }>; timeline?: { cancelReason?: string; cancelledBy?: string };
};

const PAGE = 50;
const STATUSES = ['new', 'accepted', 'ready', 'dispatched', 'completed', 'cancelled', 'failed'];

// Order history (Atlas "Orders"): every order from every app, filterable, searchable, exportable.
export default function OrdersHistoryPage() {
  const { filters, set, query } = useFilters('today');
  const { brands, activeLocations, locName } = useCatalog();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      api<{ orders: Order[]; mode: string }>(`/api/food-hub/orders?limit=5000&${query}${status ? `&status=${status}` : ''}${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ''}`)
        .then((d) => { if (alive) { setOrders(d.orders); setMode(d.mode); setError(''); setPage(0); } })
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => alive && setLoading(false));
    }, search ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [query, status, search]);

  const counted = orders.filter((o) => o.status !== 'cancelled');
  const sales = counted.reduce((s, o) => s + Number(o.total || 0), 0);
  const shown = useMemo(() => orders.slice(page * PAGE, (page + 1) * PAGE), [orders, page]);
  const pages = Math.max(1, Math.ceil(orders.length / PAGE));
  const exportQuery = `${query}${status ? `&statuses=${status}` : ''}`;

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Order history</h1>
          <div className="small">Every order from Uber Eats, DoorDash, SkipTheDishes and Too Good To Go. Click an order for its full timeline.</div>
        </div>
        <div className="fh-row">
          <a className="button btn-light" href={`/api/food-hub/reports/order_transactions?format=csv&${exportQuery}`}>Export CSV</a>
          <a className="button btn-light" href={`/api/food-hub/reports/order_transactions?format=xlsx&${exportQuery}`}>Export Excel</a>
        </div>
      </div>
      <ModeBanner mode={mode} />
      <FilterBar
        filters={filters} set={set} brands={brands.filter((b) => b.active).map((b) => b.name)} locations={activeLocations}
        extra={<>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
          </select>
          <input type="search" placeholder="Order #, customer, Clover id…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
        </>}
      />
      {error && <div className="fh-banner warn">{error}</div>}

      <div className="fh-row" style={{ marginBottom: 10 }}>
        <span className="badge badge-blue">{orders.length} orders</span>
        <span className="badge badge-green">{money(sales)} sales</span>
        <span className="badge badge-blue">avg {money(counted.length ? sales / counted.length : 0)}</span>
        {orders.length - counted.length > 0 && <span className="badge badge-red">{orders.length - counted.length} cancelled</span>}
        {loading && <span className="small">Loading…</span>}
      </div>

      <div className="fh-table-wrap">
        <table>
          <thead><tr><th>Placed</th><th>Platform</th><th>Order</th><th>Brand</th><th>Location</th><th>Customer</th><th>Items</th><th>Status</th><th>Clover</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id}>
                <td className="small">{fmtTime(o.createdAt, true)}</td>
                <td><Marketplace value={o.marketplace} /></td>
                <td><Link className="fh-link" href={`/dashboard/food-hub/orders/${o.id}`}><strong>#{o.displayId || o.externalOrderId.slice(0, 8)}</strong></Link></td>
                <td>{o.brandName ?? <span className="small">unmapped</span>}</td>
                <td className="small">{o.locationCode ? locName(o.locationCode) : '—'}</td>
                <td className="small">{o.customerName ?? '—'}</td>
                <td>{o.lines.reduce((s, l) => s + l.quantity, 0)}</td>
                <td><span className={`fh-chip st-${o.status}`} title={o.timeline?.cancelReason ?? ''}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                <td>{o.posOrderId ? <span className="badge badge-green">Yes</span> : o.posError ? <span className="badge badge-red" title={o.posError}>Failed</span> : <span className="small">—</span>}</td>
                <td style={{ textAlign: 'right' }}>{money(o.total)}</td>
              </tr>
            ))}
            {!loading && orders.length === 0 && <tr><td colSpan={10} className="small">No orders match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="fh-row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
          <button className="btn-sm btn-light" disabled={page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
          <span className="small">Page {page + 1} of {pages}</span>
          <button className="btn-sm btn-light" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
