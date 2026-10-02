import { NextResponse, type NextRequest } from 'next/server';
import { skipAdapter } from '@/lib/food-hub/adapters/skip';
import { handleSkipMenuStatus } from '@/lib/food-hub/ops';
import { background, parseJson, unauthorized } from '@/lib/food-hub/webhook-utils';

export const dynamic = 'force-dynamic';

// callback_url sent with every Skip menu push: JET reports whether the menu was published.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!skipAdapter.verifyWebhook(req.headers, raw)) return unauthorized('skip');
  const body = parseJson(raw) ?? {};
  background('skip menu status', () => handleSkipMenuStatus(body));
  return new NextResponse(null, { status: 200 });
}
