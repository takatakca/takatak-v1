'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ago, api, Marketplace, ModeBanner, money, NotifyPanel, ReasonDialog, useCatalog, useMe, useNotify } from '../ui';

type Order = {
  id: string; channel: string; marketplace: string; externalOrderId: string; displayId?: string; brandName?: string; locationCode?: string;
  customerName?: string; fulfillment: string; status: string; total: number; createdAt: string; posOrderId?: string; posError?: string; channelError?: string;
  notes?: string; lines: Array<{ name: string; quantity: number; notes?: string; modifiers: Array<{ name: string; quantity: number }> }>;
  timeline?: { readyTarget?: string | null; cancelReason?: string | null; cancelledBy?: string | null; scheduledFor?: string; fireAt?: string; firedAt?: string; courier?: { status: string; name?: string; etaAt?: string } };
  actions: string[];
};

const waitingScheduled = (o: Order) => Boolean(o.timeline?.fireAt && !o.timeline.firedAt && Date.parse(o.timeline.fireAt) > Date.now() && ['new', 'accepted'].includes(o.status));
const COURIER: Record<string, string> = { assigned: 'Courier assigned', arriving: 'Courier arriving', at_store: 'Courier at the store', picked_up: 'Picked up', delivered: 'Delivered', unassigned: 'Courier unassigned' };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

const COLUMNS: Array<{ key: string; title: string; statuses: string[]; filter?: (o: Order) => boolean }> = [
  { key: 'scheduled', title: 'Scheduled', statuses: ['new', 'accepted'], filter: waitingScheduled },
  { key: 'new', title: 'New', statuses: ['new'], filter: (o) => !waitingScheduled(o) },
  { key: 'accepted', title: 'In kitchen', statuses: ['accepted'], filter: (o) => !waitingScheduled(o) },
  { key: 'ready', title: 'Ready', statuses: ['ready'] },
  { key: 'dispatched', title: 'Picked up', statuses: ['dispatched'] },
  { key: 'done', title: 'Done / cancelled / on tablet', statuses: ['completed', 'cancelled', 'failed'] },
];

const ACTION_LABEL: Record<string, string> = { accept: 'Accept', ready: 'Mark ready', dispatch: 'Courier picked up', complete: 'Done', retry_pos: 'Send to Clover', print: 'Reprint', cancel: 'Cancel…', report_missing: 'Missing item…' };

export default function LiveOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [location, setLocation] = useState('');
  const [reasonFor, setReasonFor] = useState<{ order: Order; action: 'deny' | 'cancel' } | null>(null);
  const [showNotify, setShowNotify] = useState(false);
  const notify = useNotify();
  const alertRef = useRef(notify.alert);
  useEffect(() => { alertRef.current = notify.alert; }, [notify.alert]);
  const { activeLocations, locName } = useCatalog();
  const { can } = useMe();
  const seen = useRef<Set<string> | null>(null);
  const seenCancelled = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 24 * 3600_000).toISOString();
      const data = await api<{ orders: Order[]; mode: string }>(`/api/food-hub/orders?limit=300&since=${encodeURIComponent(since)}${location ? `&locations=${location}` : ''}`);
      setMode(data.mode);
      setError('');
      const fresh = data.orders.filter((o) => o.status === 'new' && seen.current && !seen.current.has(o.id));
      if (fresh.length) alertRef.current(`New order #${fresh[0].displayId || fresh[0].externalOrderId.slice(0, 8)}`, `${fresh[0].brandName ?? ''} · ${money(fresh[0].total)}`, 'order');
      const newlyCancelled = data.orders.filter((o) => o.status === 'cancelled' && seenCancelled.current && !seenCancelled.current.has(o.id) && o.timeline?.cancelledBy !== 'store');
      if (newlyCancelled.length) alertRef.current(`Order #${newlyCancelled[0].displayId} cancelled by ${newlyCancelled[0].timeline?.cancelledBy ?? 'the platform'}`, newlyCancelled[0].timeline?.cancelReason ?? '', 'cancel');
      seen.current = new Set(data.orders.map((o) => o.id));
      seenCancelled.current = new Set(data.orders.filter((o) => o.status === 'cancelled').map((o) => o.id));
      setOrders(data.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [location]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const waiting = orders.filter((o) => o.status === 'new').length;
  useEffect(() => {
    if (!waiting || !notify.settings.repeat) return;
    const t = setInterval(() => alertRef.current(`${waiting} order(s) waiting`, 'Accept or reject them', 'order'), 20_000);
    return () => clearInterval(t);
  }, [waiting, notify.settings.repeat]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }, [toast]);

  function act(order: Order, action: string) {
    if (action === 'deny' && order.channel === 'skip') {
      if (window.confirm('Hand this order to the Skip tablet? (Skip does not cancel it — the kitchen makes it from the tablet.)')) run(order, 'deny', { reason: 'Handled on Skip tablet' });
      return;
    }
    if (action === 'deny' || action === 'cancel') { setReasonFor({ order, action }); return; }
    run(order, action, {});
  }

  async function run(order: Order, action: string, extra: { reason?: string; reasonCode?: string }) {
    setBusy(order.id + action);
    try {
      const res = await api<{ result: { ok: boolean; message: string } }>(`/api/food-hub/orders/${order.id}`, { method: 'POST', json: { action, ...extra } });
      setToast(`#${order.displayId || order.externalOrderId.slice(0, 8)}: ${res.result.message}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      load();
    }
  }

  const todayTotal = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total || 0), 0);

  return (
    <div>
      <div className="fh-head">
        <div>
          <h1>Order Board</h1>
          <div className="small">Uber Eats, DoorDash, SkipTheDishes and Too Good To Go in one place — last 24 hours, refreshes every 5 seconds.</div>
        </div>
        <div className="fh-row">
          <select value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location">
            <option value="">All locations</option>
            {activeLocations.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <span className="badge badge-blue">{orders.length} orders · {money(todayTotal)}</span>
          <button className="btn-sm btn-light" onClick={() => setShowNotify(true)}>{notify.settings.sound ? '🔔 Alerts' : '🔕 Alerts'}</button>
          <Link className="btn-sm btn-light button" href="/dashboard/food-hub/orders">Order history →</Link>
        </div>
      </div>
      <ModeBanner mode={mode} />
      {error && <div className="fh-banner warn">Could not load orders: {error}</div>}
      {toast && <div className="fh-banner info">{toast}</div>}
      {showNotify && <NotifyPanel settings={notify.settings} update={notify.update} onClose={() => setShowNotify(false)} />}
      {reasonFor && (
        <ReasonDialog
          title={`${reasonFor.action === 'deny' ? 'Reject' : 'Cancel'} order #${reasonFor.order.displayId || reasonFor.order.externalOrderId.slice(0, 8)}`}
          note={reasonFor.action === 'cancel' ? 'Uber Eats is told the reason and handles the customer refund.' : 'The reason is sent to the platform using its own matching code.'}
          onClose={() => setReasonFor(null)}
          onPick={(code, details) => { const r = reasonFor; setReasonFor(null); run(r.order, r.action, { reasonCode: code, reason: details }); }}
        />
      )}

      <div className="fh-board fh-board-5">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status) && (!col.filter || col.filter(o)));
          if (col.key === 'scheduled' && list.length === 0) return null;
          return (
            <div className="fh-col" key={col.key}>
              <h2>{col.title}<span>{list.length}</span></h2>
              {list.length === 0 && <div className="small" style={{ padding: 6 }}>Nothing here.</div>}
              {list.map((o) => (
                <div key={o.id} className={`fh-order ${o.status === 'new' ? 'is-new' : ''}`}>
                  <div className="top">
                    <div className="fh-row"><Marketplace value={o.marketplace} /><Link href={`/dashboard/food-hub/orders/${o.id}`} className="fh-link"><strong>#{o.displayId || o.externalOrderId.slice(0, 8)}</strong></Link></div>
                    <span className="total">{money(o.total)}</span>
                  </div>
                  <div className="small" style={{ marginTop: 4 }}>
                    {o.brandName || 'Unmapped brand'} · {o.locationCode ? locName(o.locationCode) : 'unmapped store'} · {o.fulfillment} · {ago(o.createdAt)}
                    {o.customerName ? <><br />{o.customerName}</> : null}
                    {waitingScheduled(o) && o.timeline?.scheduledFor ? <><br /><strong>⏰ For {hhmm(o.timeline.scheduledFor)}</strong> · kitchen ticket at {hhmm(o.timeline.fireAt!)}</> : null}
                    {!waitingScheduled(o) && o.status === 'accepted' && o.timeline?.readyTarget ? <><br />Ready by {hhmm(o.timeline.readyTarget)}</> : null}
                    {o.timeline?.courier ? <><br /><span className={`cc-courier c-${o.timeline.courier.status}`}>🛵 {COURIER[o.timeline.courier.status] ?? o.timeline.courier.status}{o.timeline.courier.name ? ` · ${o.timeline.courier.name}` : ''}{o.timeline.courier.etaAt && ['assigned', 'arriving'].includes(o.timeline.courier.status) ? ` · ${hhmm(o.timeline.courier.etaAt)}` : ''}</span></> : null}
                    {o.status === 'cancelled' && o.timeline?.cancelReason ? <><br />Cancelled{o.timeline.cancelledBy ? ` by ${o.timeline.cancelledBy}` : ''}: {o.timeline.cancelReason}</> : null}
                  </div>
                  <ul>
                    {o.lines.map((l, i) => (
                      <li key={i}>
                        {l.quantity}× {l.name}
                        {l.modifiers.length > 0 && <span> — {l.modifiers.map((m) => `${m.quantity > 1 ? `${m.quantity}× ` : ''}${m.name}`).join(', ')}</span>}
                        {l.notes && <span> · “{l.notes}”</span>}
                      </li>
                    ))}
                  </ul>
                  {o.notes && <div className="small">Note: {o.notes}</div>}
                  <div className="fh-row" style={{ marginTop: 6 }}>
                    {o.posOrderId ? <span className="badge badge-green">In Clover</span> : o.posError ? <span className="badge badge-red" title={o.posError}>Clover: not sent</span> : o.status === 'cancelled' ? null : <span className="badge badge-yellow">Clover pending</span>}
                    {o.channelError && <span className="badge badge-yellow" title={o.channelError}>Platform not updated — hover for reason</span>}
                  </div>
                  {can('orders:act') && (
                    <div className="fh-actions">
                      {o.actions.includes('accept') && <button className="btn-sm btn-ok" disabled={!!busy} onClick={() => act(o, 'accept')}>Accept</button>}
                      {o.actions.includes('deny') && <button className="btn-sm btn-danger" disabled={!!busy} onClick={() => act(o, 'deny')}>{o.channel === 'skip' ? 'Send to Skip tablet' : 'Reject'}</button>}
                      {o.actions.filter((a) => a !== 'accept' && a !== 'deny' && a !== 'report_missing').map((a) => (
                        <button key={a} className={`btn-sm ${a === 'ready' || a === 'dispatch' ? '' : 'btn-light'}`} disabled={!!busy} onClick={() => act(o, a)}>{ACTION_LABEL[a] ?? a}</button>
                      ))}
                      <Link className="btn-sm btn-light button" href={`/dashboard/food-hub/orders/${o.id}/ticket`} target="_blank">Ticket</Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
