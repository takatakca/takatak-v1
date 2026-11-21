// The automatic monthly report: when it runs and which month it covers.
// Pure, so it is tested without a database.

export const MONTHLY_SCHEDULE_SOURCE = "monthly_auto";
export const MONTHLY_SCHEDULE_NAME = "Rapport mensuel automatique · Automatic monthly report";

/** The 1st of the next month, 12:00 UTC (morning in Québec): when the next report is built. */
export function nextMonthlyRun(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12));
}

/** The month a run covers: the month that ended just before the run date ("YYYY-MM"). */
export function monthCoveredBy(runAt: Date): string {
  const d = new Date(Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isDue(nextRunAt: Date | null, now: Date): boolean {
  return nextRunAt !== null && nextRunAt.getTime() <= now.getTime();
}
