import { logActivity } from '@/lib/food-hub/activity';
import { withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { parseFilters, parseRange } from '@/lib/food-hub/report-filter';
import { buildReport, emailReport, REPORTS, type ReportKey } from '@/lib/food-hub/reports';

export const dynamic = 'force-dynamic';

// "Email this report now": same filters as the download, sent as an attachment.
export const POST = withPerm('analytics:view', async (req, _ctx, actor) => {
  const b = await readJson(req);
  if (!(String(b.report) in REPORTS)) return fail('Unknown report');
  const emails: string[] = (Array.isArray(b.emails) ? b.emails : String(b.emails || '').split(',')).map((e: string) => e.trim()).filter(Boolean);
  if (!emails.length) return fail('Enter at least one email address.');
  const q = new URLSearchParams(Object.entries(b.query ?? {}).map(([k, v]) => [k, String(v)]));
  const table = await buildReport(b.report as ReportKey, { ...parseRange(q), ...parseFilters(q, actor) });
  const r = await emailReport(table, emails, b.format === 'xlsx' ? 'xlsx' : 'csv');
  await logActivity({ actor: actor.name, source: actor.source, kind: 'settings', action: 'report_email', status: r.ok ? 'success' : 'failed', summary: `${table.title} emailed to ${emails.join(', ')}: ${r.message}` });
  return r.ok ? ok({ message: r.message, rows: table.rows.length }) : fail(r.message, 409);
});
