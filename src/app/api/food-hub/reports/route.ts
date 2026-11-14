import { withPerm } from '@/lib/food-hub/auth';
import { ok } from '@/lib/food-hub/http';
import { emailConfigured, listReportSchedules, REPORTS } from '@/lib/food-hub/reports';

export const dynamic = 'force-dynamic';

export const GET = withPerm('analytics:view', async () => ok({
  reports: Object.entries(REPORTS).map(([key, r]) => ({ key, ...r })),
  schedules: await listReportSchedules(),
  emailConfigured: emailConfigured(),
}));
