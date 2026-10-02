import { isChannelKey } from '@/lib/food-hub/adapters';
import { ok } from '@/lib/food-hub/http';
import { reconcile } from '@/lib/food-hub/recon/engine';
import { withFinance } from '@/lib/food-hub/recon/http';
import { parseRange } from '@/lib/food-hub/report-filter';
import type { ChannelKey } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/food-hub/recon?from=2026-09-01&to=2026-09-30&channels=uber_eats&locations=NDG_MAIN
export const GET = withFinance('analytics:view', async (req) => {
  const q = new URL(req.url).searchParams;
  const range = parseRange(q, 30);
  const channels = (q.get('channels') || '').split(',').filter(isChannelKey) as ChannelKey[];
  const locationCodes = (q.get('locations') || '').split(',').filter(Boolean);
  return ok({ ...(await reconcile({ ...range, channels, locationCodes })) });
});
