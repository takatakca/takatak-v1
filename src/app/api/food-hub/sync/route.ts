import { withPerm } from '@/lib/food-hub/auth';
import { ok, readJson } from '@/lib/food-hub/http';
import { lastSyncReport, runSync } from '@/lib/food-hub/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Dashboard-triggered sync (behind the dashboard password). Rate-limited to one run per
// FOODHUB_SYNC_MIN_INTERVAL_S (default 60 s) unless { force: true }.
export const POST = withPerm('view', async (req) => {
  const body = await readJson(req);
  const res = await runSync({ trigger: body.trigger === 'auto' ? 'dashboard-auto' : 'dashboard', force: body.force === true });
  return ok({ ran: res.ran, reason: res.reason ?? null, report: res.report });
});

export const GET = withPerm('view', async () => ok({ report: await lastSyncReport() }));
