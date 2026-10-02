import { NextResponse, type NextRequest } from 'next/server';
import { parseGenericOrder, tgtgAdapter } from '@/lib/food-hub/adapters/partner';
import { background, keepUnparsed, parseJson, queueOrder, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// Too Good To Go bag orders (when a partner feed is enabled). Token protected.
// Unknown shapes are kept under Channels → Unparsed payloads, never lost.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!tgtgAdapter.verifyWebhook(req.headers, raw)) return unauthorized('tgtg');
  const body = parseJson(raw);
  if (body === undefined) return NextResponse.json({ ok: false }, { status: 400 });
  const order = parseGenericOrder('tgtg', 'tgtg', body);
  if (!order) {
    background('keep unparsed tgtg', () => keepUnparsed('tgtg', body, 'Payload shape not recognized yet'));
    return NextResponse.json({ ok: true, stored: 'unparsed' });
  }
  queueOrder(order);
  return NextResponse.json({ ok: true });
}
