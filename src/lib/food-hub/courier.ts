// Courier / driver tracking across platforms (UrbanPiper "rider status").
//   SkipTheDishes (JET Connect "Driver Status Notification"): driverArrivingAtRestaurant, driverAtRestaurant, onItsWay, delivered
//   DoorDash (Dasher Status webhooks): dasher_assigned / dasher_confirmed, arriving_at_store (400 m away), picked up, dropped off
//   Uber Eats: courier details inside the order payload when Uber shares them
// Picked up → the order moves to "Picked up"; delivered → "Completed".
import { logActivity } from './activity';
import { CHANNEL_LABELS, nowIso } from './config';
import { settleInClover } from './clover-settle';
import { getRepo } from './repo';
import type { ChannelKey, CourierInfo, CourierStatus, OrderTimeline, StoredOrder } from './types';

export const COURIER_LABEL: Record<CourierStatus, string> = {
  assigned: 'Courier assigned', arriving: 'Courier arriving', at_store: 'Courier at the store', picked_up: 'Picked up', delivered: 'Delivered', unassigned: 'Courier unassigned',
};

const SKIP_CODES: Record<string, CourierStatus> = {
  driverarrivingatrestaurant: 'arriving', driveratrestaurant: 'at_store', onitsway: 'picked_up', delivered: 'delivered',
  driverassigned: 'assigned', driverunassigned: 'unassigned',
};

export function skipCourierStatus(code: unknown): CourierStatus | null {
  return SKIP_CODES[String(code ?? '').replace(/[^a-z]/gi, '').toLowerCase()] ?? null;
}

/** DoorDash dasher events (names vary by integration type, so match on meaning). */
export function doorDashCourierStatus(eventType: string): CourierStatus | null {
  const e = eventType.toLowerCase();
  if (!/dasher|arriving|courier|driver|picked|dropped/.test(e)) return null;
  if (/unassign/.test(e)) return 'unassigned';
  if (/dropped|delivered|drop_off|dropoff/.test(e)) return 'delivered';
  if (/picked|pick_up|pickup_complete/.test(e)) return 'picked_up';
  if (/arriving/.test(e)) return 'arriving';
  if (/arrived|at_store|at_merchant|at_restaurant/.test(e)) return 'at_store';
  if (/assign|confirm/.test(e)) return 'assigned';
  return null;
}

const str = (...v: unknown[]) => { for (const x of v) if (typeof x === 'string' && x.trim()) return x.trim(); return undefined; };
const iso = (v: unknown) => { const t = typeof v === 'number' ? (v > 1e12 ? v : v * 1000) : Date.parse(String(v ?? '')); return Number.isFinite(t) && t > 0 ? new Date(t).toISOString() : undefined; };

/** Courier details from a DoorDash dasher payload (field names differ between DoorDash products). */
export function doorDashCourierDetails(body: any): Partial<CourierInfo> {
  const d = body?.dasher ?? body?.courier ?? body?.order?.dasher ?? {};
  const v = d.vehicle ?? body?.dasher_vehicle ?? {};
  return {
    name: str(d.first_name && `${d.first_name}${d.last_name ? ` ${String(d.last_name).slice(0, 1)}.` : ''}`, d.name, body?.dasher_name),
    phone: str(d.phone_number, d.phone, body?.dasher_phone_number),
    vehicle: str([v.color, v.make, v.model].filter(Boolean).join(' '), typeof v === 'string' ? v : undefined),
    etaAt: iso(body?.estimated_pickup_time ?? body?.dasher_estimated_arrival_time ?? d.estimated_arrival_time ?? body?.pickup_time_estimated),
  };
}

/** Courier details inside an Uber Eats order payload, when Uber shares them. */
export function uberCourierDetails(o: any): Partial<CourierInfo> | undefined {
  const del = Array.isArray(o?.deliveries) ? o.deliveries[0] : o?.delivery;
  const p = del?.delivery_partner ?? del?.courier ?? o?.courier;
  if (!p && !del) return undefined;
  const status = String(del?.status ?? del?.current_status ?? '').toLowerCase();
  const mapped: CourierStatus | undefined = /deliver|complete/.test(status) ? 'delivered' : /pick/.test(status) ? 'picked_up' : /arriv/.test(status) ? 'at_store' : /en_route|assign|accept/.test(status) ? 'assigned' : undefined;
  return {
    ...(mapped ? { status: mapped } : {}),
    name: str(p?.name, p?.first_name),
    phone: str(p?.phone_number, p?.phone),
    vehicle: str(p?.vehicle?.type && [p.vehicle.color, p.vehicle.make, p.vehicle.model, p.vehicle.type].filter(Boolean).join(' '), typeof p?.vehicle === 'string' ? p.vehicle : undefined),
    etaAt: iso(del?.estimated_pick_up_time ?? del?.estimated_pickup_time ?? o?.estimated_courier_arrival),
  };
}

/** Saves a courier update on the order and moves the order forward when the courier picks it up / delivers it. */
export async function applyCourierUpdate(channel: ChannelKey, externalOrderId: string, update: Partial<CourierInfo> & { status: CourierStatus }, source: string): Promise<StoredOrder | null> {
  const repo = getRepo();
  const order = await repo.findOrder(channel, externalOrderId);
  if (!order) return null;
  const now = nowIso();
  const clean = Object.fromEntries(Object.entries(update).filter(([, v]) => v !== undefined && v !== '')) as Partial<CourierInfo>;
  const courier: CourierInfo = { ...(order.timeline?.courier ?? {}), ...clean, status: update.status, updatedAt: now, source } as CourierInfo;
  const timeline: OrderTimeline = { ...(order.timeline ?? {}), courier };
  let status = order.status;
  if (update.status === 'picked_up' && ['new', 'accepted', 'ready'].includes(order.status)) {
    status = 'dispatched';
    timeline.dispatchedAt = timeline.dispatchedAt ?? now;
    timeline.readyAt = timeline.readyAt ?? now;
  }
  if (update.status === 'delivered' && !['cancelled', 'completed'].includes(order.status)) {
    status = 'completed';
    timeline.dispatchedAt = timeline.dispatchedAt ?? now;
    timeline.completedAt = timeline.completedAt ?? now;
  }
  let saved = await repo.updateOrder(order.id, { timeline, status });
  if (status !== order.status) saved = await settleInClover(saved); // picked up / delivered → paid in Clover
  await repo.addEvent(order.id, 'courier', { status: update.status, name: courier.name, etaAt: courier.etaAt, source, message: COURIER_LABEL[update.status] });
  if (status !== order.status) {
    await logActivity({ actor: CHANNEL_LABELS[channel], source: 'platform', kind: 'order', action: `courier_${update.status}`, status: 'info', channel, brandName: order.brandName, locationCode: order.locationCode, orderId: order.id,
      summary: `${CHANNEL_LABELS[channel]} #${order.displayId || order.externalOrderId.slice(0, 8)}: ${COURIER_LABEL[update.status]}${courier.name ? ` (${courier.name})` : ''}` });
  }
  return saved;
}
