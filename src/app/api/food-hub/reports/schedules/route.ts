import { withPerm } from '@/lib/food-hub/auth';
import { fail, ok, readJson } from '@/lib/food-hub/http';
import { deleteReportSchedule, listReportSchedules, saveReportSchedule, type ReportKey } from '@/lib/food-hub/reports';

export const dynamic = 'force-dynamic';

export const GET = withPerm('analytics:view', async () => ok({ schedules: await listReportSchedules() }));

// Daily (yesterday), weekly (Mondays, previous week) or monthly (1st, previous month), sent after 8:00.
export const POST = withPerm('analytics:view', async (req, _ctx, actor) => {
  const b = await readJson(req);
  const emails = (Array.isArray(b.emails) ? b.emails : String(b.emails || '').split(',')).map(String);
  const schedule = await saveReportSchedule({
    id: b.id ? String(b.id) : undefined, report: String(b.report) as ReportKey, frequency: b.frequency, emails, format: b.format === 'xlsx' ? 'xlsx' : 'csv',
    filter: { locationCodes: actor.locations.length ? actor.locations : Array.isArray(b.locationCodes) ? b.locationCodes : undefined, channels: Array.isArray(b.channels) ? b.channels : undefined, brands: Array.isArray(b.brands) ? b.brands : undefined },
  }, actor);
  return ok({ schedule });
});

export const DELETE = withPerm('analytics:view', async (req, _ctx, actor) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id || !(await deleteReportSchedule(id, actor))) return fail('Schedule not found', 404);
  return ok();
});
