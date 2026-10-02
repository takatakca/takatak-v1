import { NextResponse, type NextRequest } from 'next/server';
import { publicBaseUrl } from '@/lib/food-hub/config';
import { finishUberConnect } from '@/lib/food-hub/adapters/uber-provision';

export const dynamic = 'force-dynamic';

// Uber redirects the owner's browser here. Public route (see proxy.ts) — protected by the
// single-use, 15-minute `state` created by /start; the merchant token never leaves the server.
export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') || '';
  const code = req.nextUrl.searchParams.get('code') || '';
  const denied = req.nextUrl.searchParams.get('error');
  const back = `${publicBaseUrl()}/dashboard/food-hub/stores`;
  if (denied || !code || !state) return NextResponse.redirect(`${back}?uber_error=${encodeURIComponent(denied ? `Uber: ${denied}` : 'Uber did not return a code.')}`);
  const r = await finishUberConnect(state, code);
  return NextResponse.redirect(r.ok ? `${back}?uber_connect=${r.id}` : `${back}?uber_error=${encodeURIComponent(r.error || 'Uber connection failed')}`);
}
