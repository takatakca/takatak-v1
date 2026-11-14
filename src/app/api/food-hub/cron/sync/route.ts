import type { NextRequest } from 'next/server';
import { safeEqual } from '@/lib/food-hub/config';
import { fail, guard, ok } from '@/lib/food-hub/http';
import { runSync } from '@/lib/food-hub/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Scheduled sync: Vercel Cron (or any free pinger such as cron-job.org) with
// "Authorization: Bearer <CRON_SECRET>". Also re-opens timed pauses.
export const GET = guard(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const header = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(header, secret)) return fail('Unauthorized', 401);
  const res = await runSync({ trigger: 'cron', force: true });
  const r = res.report;
  return ok({
    ran: res.ran, reason: res.reason ?? null, stores: r?.stores.length ?? 0, errors: r ? r.stores.filter((s) => !s.ok).length : 0,
    reopened: r?.reopened ?? 0, autoCompleted: r?.autoCompleted ?? 0, itemsReenabled: r?.itemsReenabled ?? 0, holidayClosures: r?.holidayClosures ?? 0,
    scheduledPublishes: r?.scheduledPublishes ?? 0, reportsSent: r?.reportsSent ?? 0, scheduledFired: r?.scheduledFired ?? 0,
    cloverInventory: r?.cloverInventory ?? null,
  });
});
