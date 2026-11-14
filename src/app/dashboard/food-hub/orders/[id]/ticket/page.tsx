'use client';

import { use, useEffect, useRef, useState } from 'react';
import { api, MK_LABEL, money, useCatalog } from '../../../ui';

type Order = {
  id: string; channel: string; externalOrderId: string; displayId?: string; brandName?: string; locationCode?: string; customerName?: string;
  fulfillment: string; status: string; placedAt: string; createdAt: string; subtotal: number; tax: number; deliveryFee: number; tip: number; discount: number; total: number; notes?: string;
  posOrderId?: string; timeline?: { readyTarget?: string };
  lines: Array<{ name: string; quantity: number; total: number; notes?: string; modifiers: Array<{ name: string; quantity: number }> }>;
};

// 80 mm kitchen / bag ticket. Opens the print dialog automatically; works with any receipt printer the browser can see.
export default function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const printed = useRef(false);
  const { locName } = useCatalog();

  useEffect(() => { api<{ order: Order }>(`/api/food-hub/orders/${id}`).then((d) => setOrder(d.order)).catch((e) => setError(String(e.message || e))); }, [id]);
  useEffect(() => {
    if (!order || printed.current) return;
    printed.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get('autoprint') !== '0') setTimeout(() => window.print(), 300);
  }, [order]);

  if (error) return <div className="fh-banner warn">{error}</div>;
  if (!order) return <p className="small">Loading…</p>;
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <div className="ticket-wrap">
      <div className="no-print fh-row" style={{ marginBottom: 12 }}>
        <button onClick={() => window.print()}>Print</button>
        <button className="btn-light" onClick={() => window.close()}>Close</button>
      </div>
      <div className="ticket">
        <div className="t-center t-big">{MK_LABEL[order.channel] ?? order.channel}</div>
        <div className="t-center t-huge">#{order.displayId || order.externalOrderId.slice(0, 8)}</div>
        <div className="t-center">{order.brandName ?? ''}</div>
        <div className="t-center small">{order.locationCode ? locName(order.locationCode) : ''}</div>
        <div className="t-rule" />
        <div className="t-row"><span>{order.fulfillment.toUpperCase()}</span><span>{time(order.placedAt || order.createdAt)}</span></div>
        {order.timeline?.readyTarget && <div className="t-row"><span>READY BY</span><strong>{time(order.timeline.readyTarget)}</strong></div>}
        {order.customerName && <div className="t-row"><span>Customer</span><span>{order.customerName}</span></div>}
        {order.status === 'cancelled' && <div className="t-center t-big">*** CANCELLED ***</div>}
        <div className="t-rule" />
        {order.lines.map((l, i) => (
          <div key={i} className="t-line">
            <div className="t-row"><strong>{l.quantity} × {l.name}</strong><span>{money(l.total)}</span></div>
            {l.modifiers.map((m, j) => <div key={j} className="t-mod">+ {m.quantity > 1 ? `${m.quantity}× ` : ''}{m.name}</div>)}
            {l.notes && <div className="t-mod">» {l.notes}</div>}
          </div>
        ))}
        {order.notes && <><div className="t-rule" /><div><strong>NOTE:</strong> {order.notes}</div></>}
        <div className="t-rule" />
        <div className="t-row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        {order.discount ? <div className="t-row"><span>Discount</span><span>−{money(order.discount)}</span></div> : null}
        <div className="t-row"><span>Tax</span><span>{money(order.tax)}</span></div>
        {order.deliveryFee ? <div className="t-row"><span>Delivery</span><span>{money(order.deliveryFee)}</span></div> : null}
        {order.tip ? <div className="t-row"><span>Tip</span><span>{money(order.tip)}</span></div> : null}
        <div className="t-row t-big"><strong>TOTAL</strong><strong>{money(order.total)}</strong></div>
        <div className="t-rule" />
        <div className="t-center small">{order.posOrderId ? `Clover ${order.posOrderId}` : 'Not in Clover'} · TAKATAK Food Hub</div>
      </div>
    </div>
  );
}
