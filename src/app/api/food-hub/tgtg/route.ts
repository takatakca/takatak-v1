import { inScope, withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { listBagDays, saveBagDay } from '@/lib/food-hub/tgtg';

export const dynamic = 'force-dynamic';

export const GET = withPerm('view', async (req, _ctx, actor) => {
  const q = new URL(req.url).searchParams;
  const days = (await listBagDays(q.get('from') || undefined, q.get('to') || undefined)).filter((d) => inScope(actor, d.locationCode));
  return ok({ days });
});

// { date, locationCode, bagsOffered, bagsSold, pricePerBag, note? }
export const POST = withPerm('orders:act', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.locationCode || !inScope(actor, String(b.locationCode))) return fail('Choose one of your locations.', 403);
  try {
    const day = await saveBagDay({ date: String(b.date || ''), locationCode: String(b.locationCode), bagsOffered: Number(b.bagsOffered), bagsSold: Number(b.bagsSold), pricePerBag: Number(b.pricePerBag), note: b.note ? String(b.note) : undefined }, actor);
    return ok({ day });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
});
