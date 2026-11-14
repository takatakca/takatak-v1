import { fail, ok, readJson } from '@/lib/food-hub/http';
import { requestUberPaymentReport, UBER_REQUESTS, type UberReportRequest } from '@/lib/food-hub/recon/automation';
import { withFinance } from '@/lib/food-hub/recon/http';
import { getRepo } from '@/lib/food-hub/repo';

export const dynamic = 'force-dynamic';

export const GET = withFinance('analytics:view', async () => ok({ requests: (await getRepo().listDocs<UberReportRequest>(UBER_REQUESTS, { limit: 20 })).map((d) => d.data) }));

// { from: "2026-09-01", to: "2026-09-30" } → Uber builds the Payment Details report and sends it to the webhook.
export const POST = withFinance('finance:edit', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(String(b.from)) || !re.test(String(b.to)) || b.to < b.from) return fail('Choose a valid date range.');
  const r = await requestUberPaymentReport(String(b.from), String(b.to), actor);
  return r.status === 'failed' ? fail(r.message, 409) : ok({ request: r });
});
