import { NextResponse, type NextRequest } from 'next/server';
import { skipAdapter } from '@/lib/food-hub/adapters/skip';
import { applyExternalStatus } from '@/lib/food-hub/pipeline';
import { background, parseJson, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// JET Connect "Cancel Order Notification": { orderID, reason: { code }, happenedAt }
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!skipAdapter.verifyWebhook(req.headers, raw)) return unauthorized('skip');
  const body = parseJson(raw);
  if (!body?.orderID) return NextResponse.json({ error: 'orderID missing' }, { status: 400 });
  background(`skip cancel ${body.orderID}`, () => applyExternalStatus('skip', String(body.orderID), 'cancelled', { reason: body.reason?.code, happenedAt: body.happenedAt }));
  return new NextResponse(null, { status: 200 });
}
