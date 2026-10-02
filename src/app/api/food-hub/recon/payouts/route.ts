import { isChannelKey } from '@/lib/food-hub/adapters';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { payoutBatches, recordDeposit } from '@/lib/food-hub/recon/engine';
import { withFinance } from '@/lib/food-hub/recon/http';
import { parseRange } from '@/lib/food-hub/report-filter';
import type { ChannelKey } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

export const GET = withFinance('analytics:view', async (req) => {
  const q = new URL(req.url).searchParams;
  const channels = (q.get('channels') || '').split(',').filter(isChannelKey) as ChannelKey[];
  return ok({ payouts: await payoutBatches({ ...parseRange(q, 90), channels }) });
});

// Bank deposit for one payout: { key, amount, date, note? }
export const POST = withFinance('finance:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.key) return fail('key is required');
  await recordDeposit(String(b.key), { amount: Number(b.amount), date: String(b.date || ''), note: b.note ? String(b.note) : undefined }, actor);
  return ok();
});
