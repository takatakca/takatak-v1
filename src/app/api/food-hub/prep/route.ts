import { inScope, withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { getPrepSettings, savePrep } from '@/lib/food-hub/prep';

export const dynamic = 'force-dynamic';

export const GET = withPerm('view', async () => ok({ prep: await getPrepSettings() }));

// Busy mode on/off, or change normal/busy prep minutes, for one location.
export const POST = withPerm('stores:toggle', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const loc = String(b.locationCode || '');
  if (!loc) return fail('locationCode is required');
  if (!inScope(actor, loc)) return fail('Not one of your locations.', 403);
  const prep = await savePrep(loc, {
    ...(b.isBusy !== undefined ? { isBusy: Boolean(b.isBusy) } : {}),
    ...(b.normal !== undefined ? { normal: Number(b.normal) } : {}),
    ...(b.busy !== undefined ? { busy: Number(b.busy) } : {}),
  }, actor);
  return ok({ prep });
});
