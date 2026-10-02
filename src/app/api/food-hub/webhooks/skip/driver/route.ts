import { NextResponse, type NextRequest } from 'next/server';
import { skipAdapter } from '@/lib/food-hub/adapters/skip';
import { applyCourierUpdate, skipCourierStatus } from '@/lib/food-hub/courier';
import { background, parseJson, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// JET Connect "Driver Status Notification": { orderID, driverStatus: { code }, happenedAt }
// codes: driverArrivingAtRestaurant, driverAtRestaurant, onItsWay, delivered. JET expects 200 + the same payload back.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!skipAdapter.verifyWebhook(req.headers, raw)) return unauthorized('skip');
  const body = parseJson(raw);
  if (!body?.orderID) return NextResponse.json({ error: 'orderID missing' }, { status: 400 });
  const status = skipCourierStatus(body.driverStatus?.code);
  if (status) background(`skip driver ${body.orderID}`, () => applyCourierUpdate('skip', String(body.orderID), { status }, 'skip:driver_status'));
  return NextResponse.json(body, { status: 200 });
}
