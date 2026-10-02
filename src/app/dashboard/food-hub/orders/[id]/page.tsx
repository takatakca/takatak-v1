'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api, fmtTime, Marketplace, Modal, money, ReasonDialog, Section, STATUS_LABEL, useCatalog, useMe } from '../../ui';

type Order = {
  id: string; channel: string; marketplace: string; externalOrderId: string; displayId?: string; channelStoreId: string; brandName?: string; locationCode?: string;
  customerName?: string; fulfillment: string; status: string; placedAt: string; readyBy?: string; currency: string;
  subtotal: number; tax: number; deliveryFee: number; tip: number; discount: number; total: number; notes?: string;
  lines: Array<{ name: string; externalId?: string; quantity: number; unitPrice: number; total: number; notes?: string; posItemRef?: string; modifiers: Array<{ name: string; quantity: number; unitPrice: number }> }>;
  posOrderId?: string; posError?: string; channelError?: string; createdAt: string; updatedAt: string;
  timeline?: { acceptedAt?: string; acceptedBy?: string; readyAt?: string; dispatchedAt?: string; completedAt?: string; cancelledAt?: string; cancelledBy?: string; cancelStage?: string; cancelReason?: string; readyTarget?: string; printedAt?: string;
    scheduledFor?: string; fireAt?: string; firedAt?: string; posPaymentId?: string; posPaymentError?: string;
    courier?: { status: string; name?: string; phone?: string; vehicle?: string; etaAt?: string; updatedAt: string; source: string };
    missingItems?: Array<{ name: string; quantity: number; at: string }> };
};
const MARKET_TENDER: Record<string, string> = { uber_eats: 'Uber Eats', doordash: 'DoorDash', skip: 'SkipTheDishes', tgtg: 'Too Good To Go' };
const COURIER: Record<string, string> = { assigned: 'Courier assigned', arriving: 'Courier arriving (about 400 m away)', at_store: 'Courier at the store', picked_up: 'Picked up', delivered: 'Delivered', unassigned: 'Courier unassigned' };
type Event = { type: string; detail: Record<string, any>; at: string };

const ACTION_LABEL: Record<string, string> = { accept: 'Accept', deny: 'Reject', ready: 'Mark ready', dispatch: 'Courier picked up', complete: 'Mark done', retry_pos: 'Send to Clover', print: 'Reprint kitchen ticket', cancel: 'Cancel order…', report_missing: 'Report missing item…' };
const EVENT_LABEL: Record<string, string> = {
  received: 'Received from platform', duplicate_delivery: 'Duplicate delivery ignored', unmapped_store: 'Store not mapped', pos_injected: 'Sent to Clover', pos_failed: 'Clover did not accept it', pos_skipped: 'Clover not connected',
  accepted: 'Accepted', accept_failed: 'Accept failed', deny: 'Rejected', deny_failed: 'Reject failed', accept: 'Accepted', ready: 'Marked ready', ready_failed: 'Ready not sent', dispatch: 'Courier picked up', complete: 'Completed',
  cancel: 'Cancelled', cancel_failed: 'Cancel failed', printed: 'Printed in kitchen', print_failed: 'Print failed', routed_to_skip_tablet: 'Sent to Skip tablet', needs_attention: 'Needs attention', platform_status: 'Platform update',
  pos_paid: 'Recorded as paid in Clover', pos_payment_failed: 'Clover payment not recorded', pos_cancelled: 'Removed from Clover (cancelled)', pos_cancel_failed: 'Clover still has the cancelled order', pos_paid_then_cancelled: 'Cancelled after Clover payment', scheduled: 'Scheduled order', fired: 'Sent to the kitchen (fire time)', courier: 'Courier',
  report_missing: 'Missing items reported', report_missing_failed: 'Missing items not sent',
};

function minutesBetween(a?: string, b?: string) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [reasonFor, setReasonFor] = useState<'deny' | 'cancel' | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const { locName } = useCatalog();
  const { can } = useMe();

  const load = useCallback(async () => {
    try {
      const d = await api<{ order: Order; events: Event[]; actions: string[] }>(`/api/food-hub/orders/${id}`);
      setOrder(d.order); setEvents(d.events); setActions(d.actions); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  async function run(action: string, extra: { reason?: string; reasonCode?: string; missing?: Array<{ line: number; quantity: number }> } = {}) {
    setBusy(true);
    try {
      const r = await api<{ result: { ok: boolean; message: string } }>(`/api/food-hub/orders/${id}`, { method: 'POST', json: { action, ...extra } });
      setMsg(r.result.message);
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); load(); }
  }

  function act(action: string) {
    if (!order) return;
    if (action === 'deny' && order.channel === 'skip') {
      if (window.confirm('Hand this order to the Skip tablet? (It is not cancelled — make it from the tablet.)')) run('deny', { reason: 'Handled on Skip tablet' });
      return;
    }
    if (action === 'deny' || action === 'cancel') { setReasonFor(action); return; }
    if (action === 'report_missing') { setMissingOpen(true); return; }
    run(action);
  }

  if (!order) return <div><h1>Order</h1>{error ? <div className="fh-banner warn">{error}</div> : <p className="small">Loading…</p>}</div>;
  const t = order.timeline ?? {};
  const steps: Array<[string, string | undefined, string?]> = [
    ['Placed', order.placedAt || order.createdAt],
    ['Accepted', t.acceptedAt, t.acceptedBy ? (t.acceptedBy === 'auto' ? 'automatically' : `by ${t.acceptedBy}`) : undefined],
    ...(t.scheduledFor ? [['Scheduled for', t.scheduledFor, t.fireAt ? `kitchen ticket at ${fmtTime(t.fireAt)}${t.firedAt ? ' ✓' : ''}` : undefined] as [string, string, string?]] : []),
    ['Kitchen ticket printed', t.printedAt],
    ['Ready', t.readyAt, t.readyTarget ? `target ${fmtTime(t.readyTarget)}` : undefined],
    ['Picked up by courier', t.dispatchedAt],
    ['Completed', t.completedAt],
    ['Cancelled', t.cancelledAt, [t.cancelledBy && `by ${t.cancelledBy}`, t.cancelStage && t.cancelStage.replace('_', ' '), t.cancelReason].filter(Boolean).join(' · ')],
  ];
  const prep = minutesBetween(t.acceptedAt, t.readyAt);
  const accept = minutesBetween(order.placedAt || order.createdAt, t.acceptedAt);

  return (
    <div>
      <div className="fh-head">
        <div>
          <div className="small"><Link href="/dashboard/food-hub/orders" className="fh-link">← Order history</Link></div>
          <h1 className="fh-row" style={{ gap: 10 }}><Marketplace value={order.marketplace} /> #{order.displayId || order.externalOrderId.slice(0, 8)} <span className={`fh-chip st-${order.status}`}>{STATUS_LABEL[order.status] ?? order.status}</span></h1>
          <div className="small">{order.brandName ?? 'Unmapped brand'} · {order.locationCode ? locName(order.locationCode) : `unmapped store ${order.channelStoreId}`} · {order.fulfillment} · placed {fmtTime(order.placedAt || order.createdAt, true)}</div>
        </div>
        <div className="fh-row">
          <Link className="button btn-light" href={`/dashboard/food-hub/orders/${order.id}/ticket`} target="_blank">Print ticket</Link>
          {can('orders:act') && actions.map((a) => (
            <button key={a} disabled={busy} className={a === 'accept' ? 'btn-ok' : a === 'deny' || a === 'cancel' ? 'btn-danger' : a === 'ready' || a === 'dispatch' ? '' : 'btn-light'} onClick={() => act(a)}>
              {a === 'deny' && order.channel === 'skip' ? 'Send to Skip tablet' : ACTION_LABEL[a] ?? a}
            </button>
          ))}
        </div>
      </div>
      {msg && <div className="fh-banner info">{msg}</div>}
      {error && <div className="fh-banner warn">{error}</div>}
      {order.posError && !order.posOrderId && <div className="fh-banner warn">Clover did not receive this order: {order.posError}</div>}
      {order.channelError && <div className="fh-banner warn">The platform was not updated: {order.channelError}</div>}
      {['accepted', 'ready'].includes(order.status) && order.channel !== 'uber_eats' && order.channel !== 'tgtg' && (
        <div className="small" style={{ marginBottom: 10 }}>To cancel this order after accepting it, use the {order.channel === 'doordash' ? 'DoorDash Merchant Portal or tablet' : 'Skip tablet or Skip restaurant support'} — those platforms do not allow it by API. Food Hub updates the order when the cancellation comes back.</div>
      )}
      {missingOpen && <MissingDialog lines={order.lines} onClose={() => setMissingOpen(false)} onSend={(missing) => { setMissingOpen(false); run('report_missing', { missing }); }} />}
      {reasonFor && (
        <ReasonDialog
          title={reasonFor === 'deny' ? 'Reject order' : 'Cancel order'}
          note={reasonFor === 'cancel' ? 'Uber Eats is told the reason and handles the customer refund.' : 'The reason is sent to the platform using its own matching code.'}
          onClose={() => setReasonFor(null)}
          onPick={(code, details) => { const a = reasonFor; setReasonFor(null); run(a, { reasonCode: code, reason: details }); }}
        />
      )}

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Section title="Items">
          <table>
            <thead><tr><th>Qty</th><th>Item</th><th style={{ textAlign: 'right' }}>Price</th></tr></thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.quantity}×</td>
                  <td><strong>{l.name}</strong>{!l.posItemRef && <span className="small"> · custom line in Clover</span>}
                    {l.modifiers.map((m, j) => <div key={j} className="small">+ {m.quantity > 1 ? `${m.quantity}× ` : ''}{m.name}{m.unitPrice ? ` (${money(m.unitPrice)})` : ''}</div>)}
                    {l.notes && <div className="small">“{l.notes}”</div>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{money(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="fh-kv" style={{ marginTop: 12 }}>
            <dt>Subtotal</dt><dd>{money(order.subtotal)}</dd>
            {order.discount ? <><dt>Discount</dt><dd>−{money(order.discount)}</dd></> : null}
            <dt>Tax</dt><dd>{money(order.tax)}</dd>
            {order.deliveryFee ? <><dt>Delivery fee</dt><dd>{money(order.deliveryFee)}</dd></> : null}
            {order.tip ? <><dt>Tip</dt><dd>{money(order.tip)}</dd></> : null}
            <dt><strong>Total</strong></dt><dd><strong>{money(order.total)}</strong></dd>
          </dl>
          {order.notes && <p className="small"><strong>Customer note:</strong> {order.notes}</p>}
        </Section>

        <div>
          <Section title="Timeline" right={<span className="small">{accept !== null ? `accepted in ${accept} min` : ''}{prep !== null ? ` · prep ${prep} min` : ''}</span>}>
            <ul className="fh-timeline">
              {steps.filter(([, at]) => at).map(([label, at, note]) => (
                <li key={label}><span className="t">{fmtTime(at)}</span><span><strong>{label}</strong>{note ? <span className="small"> · {note}</span> : null}</span></li>
              ))}
              {order.status !== 'cancelled' && order.status !== 'completed' && t.readyTarget && !t.readyAt && <li><span className="t">{fmtTime(t.readyTarget)}</span><span className="small">expected ready</span></li>}
            </ul>
          </Section>
          {t.courier && (
            <Section title="Courier" right={<span className="small">{t.courier.source.replace(':', ' · ')} · {fmtTime(t.courier.updatedAt)}</span>}>
              <dl className="fh-kv">
                <dt>Status</dt><dd><strong>🛵 {COURIER[t.courier.status] ?? t.courier.status}</strong></dd>
                {t.courier.name && <><dt>Name</dt><dd>{t.courier.name}</dd></>}
                {t.courier.phone && <><dt>Phone</dt><dd><a className="fh-link" href={`tel:${t.courier.phone}`}>{t.courier.phone}</a></dd></>}
                {t.courier.vehicle && <><dt>Vehicle</dt><dd>{t.courier.vehicle}</dd></>}
                {t.courier.etaAt && <><dt>At the store by</dt><dd>{fmtTime(t.courier.etaAt)}</dd></>}
              </dl>
            </Section>
          )}
          {(t.missingItems?.length ?? 0) > 0 && (
            <Section title="Reported missing">
              <ul className="small">{t.missingItems!.map((m, i) => <li key={i}>{m.quantity}× {m.name} — {fmtTime(m.at)}</li>)}</ul>
            </Section>
          )}
          <Section title="Details">
            <dl className="fh-kv">
              <dt>Customer</dt><dd>{order.customerName || '—'}</dd>
              <dt>Platform order id</dt><dd className="fh-mono">{order.externalOrderId}</dd>
              <dt>Platform store id</dt><dd className="fh-mono">{order.channelStoreId}</dd>
              <dt>Clover order</dt><dd className="fh-mono">{order.posOrderId || '—'}</dd>
              <dt>Clover payment</dt><dd>{t.posPaymentId ? <span className="badge badge-green">Recorded ({MARKET_TENDER[order.channel] ?? order.channel} tender)</span> : t.posPaymentError ? <span className="badge badge-red" title={t.posPaymentError}>Not recorded</span> : '—'}</dd>
              <dt>Customer ready-by</dt><dd>{order.readyBy ? fmtTime(order.readyBy, true) : '—'}</dd>
              <dt>Last update</dt><dd>{fmtTime(order.updatedAt, true)}</dd>
            </dl>
          </Section>
        </div>
      </div>

      <Section title="Event log" right={<button className="btn-sm btn-light" onClick={() => setShowRaw(!showRaw)}>{showRaw ? 'Hide details' : 'Show details'}</button>}>
        <ul className="fh-timeline">
          {events.map((e, i) => (
            <li key={i}><span className="t">{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span><strong>{EVENT_LABEL[e.type] ?? e.type}</strong> <span className="small">{e.detail?.message || e.detail?.error || e.detail?.reason || e.detail?.hint || e.detail?.posOrderId || e.detail?.state || e.detail?.status || ''}{e.detail?.by ? ` · ${e.detail.by}` : e.detail?.auto ? ' · automatic' : ''}</span>
                {showRaw && <pre className="small" style={{ marginTop: 4 }}>{JSON.stringify(e.detail, null, 2)}</pre>}
              </span>
            </li>
          ))}
          {events.length === 0 && <li className="small">No events recorded.</li>}
        </ul>
      </Section>
    </div>
  );
}

function MissingDialog({ lines, onSend, onClose }: { lines: Order['lines']; onSend: (m: Array<{ line: number; quantity: number }>) => void; onClose: () => void }) {
  const [qty, setQty] = useState<Record<number, number>>({});
  const picked = Object.entries(qty).filter(([, q]) => q > 0).map(([line, quantity]) => ({ line: Number(line), quantity }));
  return (
    <Modal title="Report a missing item to SkipTheDishes" onClose={onClose}>
      <p className="small">Skip removes the item from the order and adjusts what the customer pays. Use it when an item ran out after the order was accepted.</p>
      <table>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{l.quantity}× {l.name}{!l.externalId && <div className="small">no Skip item id — use the tablet</div>}</td>
              <td style={{ width: 120 }}>
                <select value={qty[i] ?? 0} disabled={!l.externalId} onChange={(e) => setQty({ ...qty, [i]: Number(e.target.value) })} aria-label={`Missing quantity of ${l.name}`}>
                  {Array.from({ length: Math.round(l.quantity) + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'none missing' : `${n} missing`}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fh-row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn-light" onClick={onClose}>Cancel</button>
        <button className="btn-danger" disabled={!picked.length} onClick={() => onSend(picked)}>Send to Skip</button>
      </div>
    </Modal>
  );
}
