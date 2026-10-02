import { NextResponse, type NextRequest } from 'next/server';
import { parseSkipOrder, skipAdapter } from '@/lib/food-hub/adapters/skip';
import { background, keepUnparsed, parseJson, queueOrder, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// JET Connect "Receive Order" for SkipTheDishes. Signed with X-JET-Connect-Hash.
// We answer 202 (async) immediately; Food Hub then creates the order in Clover and calls
// sent-to-pos-success (or sent-to-pos-failed → Skip tablet) well inside JET's 5-minute window.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!skipAdapter.verifyWebhook(req.headers, raw)) return unauthorized('skip');
  const body = parseJson(raw);
  if (body === undefined) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const order = parseSkipOrder(body);
  if (!order) {
    background('keep unparsed skip order', () => keepUnparsed('skip', body, 'JET Connect order missing id/items'));
    return NextResponse.json({ error: 'Unrecognized order payload' }, { status: 400 });
  }
  queueOrder(order);
  return new NextResponse(null, { status: 202 });
}
