import { isChannelKey } from '@/lib/food-hub/adapters';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { listCases, updateCase, type CaseStatus } from '@/lib/food-hub/recon/engine';
import { withFinance } from '@/lib/food-hub/recon/http';
import type { ChannelKey } from '@/lib/food-hub/types';

export const dynamic = 'force-dynamic';

const STATUSES: CaseStatus[] = ['open', 'disputed', 'recovered', 'written_off', 'resolved', 'ignored'];

export const GET = withFinance('analytics:view', async (req) => {
  const q = new URL(req.url).searchParams;
  const status = (q.get('status') || '').split(',').filter((s) => STATUSES.includes(s as CaseStatus)) as CaseStatus[];
  const channels = (q.get('channels') || '').split(',').filter(isChannelKey) as ChannelKey[];
  return ok({ cases: await listCases({ status, channels }) });
});

// { id, status?, note?, platformCaseId?, recoveredAmount? }
export const POST = withFinance('finance:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!b.id) return fail('id is required');
  if (b.status && !STATUSES.includes(b.status)) return fail(`status must be one of ${STATUSES.join(', ')}`);
  const c = await updateCase(String(b.id), {
    status: b.status, note: b.note ? String(b.note).slice(0, 500) : undefined, platformCaseId: b.platformCaseId ? String(b.platformCaseId).slice(0, 80) : undefined,
    recoveredAmount: b.recoveredAmount !== undefined && b.recoveredAmount !== '' ? Number(b.recoveredAmount) : undefined,
  }, actor);
  return c ? ok({ case: c }) : fail('Case not found', 404);
});
