import { withPerm } from '@/lib/food-hub/auth';
import { listCloverPriceChanges, resolveCloverPriceChange } from '@/lib/food-hub/clover-sync';
import { fail, ok, readJson } from '@/lib/food-hub/http';

export const dynamic = 'force-dynamic';

// Prices changed in Clover that differ from the Food Hub menu.
export const GET = withPerm('view', async (req) => ok({ changes: await listCloverPriceChanges(new URL(req.url).searchParams.get('brand') || undefined) }));

// { brand, ref, accept: true } → use the Clover price in the master menu; accept: false → keep Food Hub price.
export const POST = withPerm('menu:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.brand || !b.ref) return fail('brand and ref are required');
  if (!(await resolveCloverPriceChange(String(b.brand), String(b.ref), b.accept !== false, actor))) return fail('No pending Clover price change for that item.', 404);
  return ok();
});
