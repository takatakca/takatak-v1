import { withPerm } from '@/lib/food-hub/auth';
import { buildAnalytics } from '@/lib/food-hub/analytics';
import { ok } from '@/lib/food-hub/http';
import { parseFilters, parseRange } from '@/lib/food-hub/report-filter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/food-hub/analytics?from=2026-09-01&to=2026-09-30&locations=NDG_MAIN&channels=uber_eats&brands=Po%20Poulet
export const GET = withPerm('analytics:view', async (req, _ctx, actor) => {
  const q = new URL(req.url).searchParams;
  const range = parseRange(q, 7);
  const f = parseFilters(q, actor);
  return ok({ ...(await buildAnalytics({ ...range, locationCodes: f.locationCodes, channels: f.channels, brands: f.brands })) });
});
