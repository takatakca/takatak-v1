import { NextResponse, type NextRequest } from 'next/server';
import { logActivity } from '@/lib/food-hub/activity';
import { handleCloverWebhook, VERIFY_KEY } from '@/lib/food-hub/clover-sync';
import { nowIso, safeEqual } from '@/lib/food-hub/config';
import { getRepo } from '@/lib/food-hub/repo';
import { background, parseJson } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// Clover app webhooks (Clover developer dashboard → your app → Webhooks):
//  1. Clover first POSTs { verificationCode } — Food Hub shows it on Channels; paste it back in Clover.
//  2. Every event carries the header X-Clover-Auth = the auth code Clover shows → CLOVER_WEBHOOK_AUTH.
//  3. Subscribe to "Inventory" events: an item changed in Clover → availability/price sync to every platform.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const body = parseJson(raw);
  if (body === undefined) return NextResponse.json({ ok: false }, { status: 400 });

  if (body.verificationCode) {
    await getRepo().setKv(VERIFY_KEY, { code: String(body.verificationCode).slice(0, 200), at: nowIso() });
    await logActivity({ actor: 'Clover', source: 'platform', kind: 'settings', action: 'clover_webhook_verification', status: 'info', summary: 'Clover sent a webhook verification code — copy it from Channels & Setup into the Clover developer dashboard.' });
    return NextResponse.json({ ok: true });
  }

  const expected = process.env.CLOVER_WEBHOOK_AUTH;
  if (!expected || !safeEqual(String(req.headers.get('x-clover-auth') || ''), expected)) {
    return NextResponse.json({ ok: false, error: 'X-Clover-Auth check failed (set CLOVER_WEBHOOK_AUTH).' }, { status: 401 });
  }
  background('clover inventory webhook', () => handleCloverWebhook(body));
  return NextResponse.json({ ok: true });
}
