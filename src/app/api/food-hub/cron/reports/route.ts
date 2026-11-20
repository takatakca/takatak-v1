import type { NextRequest } from 'next/server';
import { safeEqual } from '@/lib/food-hub/config';
import { runDuePublishes } from '@/lib/food-hub/menu/schedule';
import { fail, guard, ok } from '@/lib/food-hub/http';
import { sendDueReports } from '@/lib/food-hub/reports';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily cron: emails due report schedules and runs due scheduled menu publishes.
export const GET = guard(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const header = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(header, secret)) return fail('Unauthorized', 401);
  const [reportsSent, publishes] = await Promise.all([sendDueReports(), runDuePublishes()]);
  return ok({ reportsSent, publishes });
});
