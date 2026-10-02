import type { NextRequest } from 'next/server';
import { safeEqual } from '@/lib/food-hub/config';
import { fail, guard, ok } from '@/lib/food-hub/http';
import { reopenExpiredPauses } from '@/lib/food-hub/ops';

export const dynamic = 'force-dynamic';

// Re-opens stores whose timed pause expired (DoorDash has no native timed pause).
// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
export const GET = guard(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const header = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(header, secret)) return fail('Unauthorized', 401);
  const results = await reopenExpiredPauses();
  return ok({ reopened: results.length, results });
});
