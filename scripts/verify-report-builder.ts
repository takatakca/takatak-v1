// Report builder (/dashboard/reports/builder): a monthly report built from
// the workspace's own numbers. Pure checks plus source guards; no database.
// Run: npm run qa:report-builder
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildableMonths, isBuildableMonth, monthlyReportPlan, REPORT_BUILDER_SOURCE, type BuilderNumbers } from "../src/lib/reports/monthly-builder";
import { isDue, monthCoveredBy, nextMonthlyRun } from "../src/lib/reports/monthly-schedule";

const zero: BuilderNumbers = {
  pageviews: 0, visits: 0, conversions: 0, ratings: 0, averageRating: null, publicReviewClicks: 0,
  requestsSent: 0, conversations: 0, leads: 0, aiRunsCompleted: 0, creditsUsed: 0, adImpressions: 0, adClicks: 0,
};
const month = { key: "2026-10", start: new Date(Date.UTC(2026, 9, 1)), end: new Date(Date.UTC(2026, 10, 1)), label: "octobre 2026" };

// 1. Months: this month and the 11 before, nothing in the future or malformed.
const now = new Date(Date.UTC(2026, 10, 21));
const months = buildableMonths(now);
assert.equal(months.length, 12);
assert.equal(months[0], "2026-11");
assert.equal(months[11], "2025-12");
assert.ok(isBuildableMonth("2026-10", now));
for (const bad of ["2026-12", "2025-11", "2026-1", "2026-10' OR 1=1", ""]) assert.ok(!isBuildableMonth(bad, now), bad);

// 2. The plan uses the numbers as they are, with the comparison to last month.
const plan = monthlyReportPlan({
  clientName: "Bistro Test",
  month,
  current: { ...zero, visits: 120, pageviews: 300, conversions: 9, leads: 4, ratings: 3, averageRating: 4.7 },
  previous: { ...zero, visits: 100, conversions: 9, leads: 0 },
  topPages: [{ label: "/menu", count: 80 }],
  topSources: [],
  highlights: ["Visites du site en hausse de 20 % par rapport au mois précédent."],
});
assert.match(plan.title, /octobre 2026/);
assert.equal(plan.periodStart.toISOString(), month.start.toISOString());
assert.equal(plan.periodEnd.toISOString(), month.end.toISOString());
assert.deepEqual(plan.metadata, { source: REPORT_BUILDER_SOURCE, month: "2026-10", version: 1 });
assert.equal(plan.metrics.length, 13);
assert.equal(plan.metrics.find((m) => m.key === "visits")?.value, "120");
assert.equal(plan.metrics.find((m) => m.key === "averageRating")?.unit, "/ 5");
const comparison = plan.sections.find((s) => s.type === "metrics")!.content;
assert.match(comparison, /120 \(\+20 %\)/);
assert.match(comparison, /Actions de contact[^\n]*9 \(stable\)/);
assert.match(comparison, /Prospects[^\n]*4 \(nouveau/);
assert.match(plan.sections.find((s) => s.type === "notes")!.content, /\/menu \(80\)/);
assert.match(plan.sections.find((s) => s.type === "notes")!.content, /aucune donnée/);

// 3. An empty month says so; no number is invented.
const empty = monthlyReportPlan({ clientName: "Vide", month, current: zero, previous: zero, topPages: [], topSources: [], highlights: ["Aucune activité enregistrée ce mois-ci."] });
assert.equal(empty.metrics.find((m) => m.key === "averageRating")?.value, "—");
assert.equal(empty.metrics.find((m) => m.key === "averageRating")?.unit, null);
assert.ok(empty.metrics.filter((m) => m.key !== "averageRating").every((m) => m.value === "0"));

// 4. The action is scoped to the active workspace, checks roles and month, and sends nothing.
const action = readFileSync("src/app/dashboard/reports/builder/actions.ts", "utf8");
assert.ok(action.indexOf("isBuildableMonth(month)") < action.indexOf("buildMonthlyReportFor("), "the month is checked first");
assert.match(action, /access\.mode !== "client_scoped"/);
assert.match(action, /hasEffectivePermission\(access, "view_reports"\)/);
assert.match(action, /hasEffectivePermission\(access, "create_content"\)/);
assert.match(action, /buildMonthlyReportFor\(prisma, \{ clientId: access\.activeClientId/);
assert.match(readFileSync("src/lib/reports/build-monthly.ts", "utf8"), /where: \{\s*clientId: input\.clientId,\s*type: "monthly_business"/, "a rebuild only ever touches this workspace's report");
assert.doesNotMatch(action, /sendEmail|resend|nodemailer|fetch\(/i, "building a report sends nothing");
const page = readFileSync("src/app/dashboard/reports/builder/page.tsx", "utf8");
assert.doesNotMatch(page, /disabled|Coming soon|Phase \d/, "no dead controls on the client screen");
assert.match(page, /export\/pdf\?id=/);
assert.doesNotMatch(readFileSync("src/lib/dashboard/dashboard-config.ts", "utf8"), /"\/dashboard\/reports\/builder",\n/, "the builder is no longer staff-only");

// 5. Automatic monthly report: runs on the 1st (12:00 UTC) and covers the month that just ended.
assert.equal(nextMonthlyRun(new Date(Date.UTC(2026, 10, 21, 8))).toISOString(), "2026-12-01T12:00:00.000Z");
assert.equal(nextMonthlyRun(new Date(Date.UTC(2026, 11, 31, 23))).toISOString(), "2027-01-01T12:00:00.000Z");
assert.equal(monthCoveredBy(new Date("2026-12-01T12:00:00Z")), "2026-11");
assert.equal(monthCoveredBy(new Date("2027-01-01T12:00:00Z")), "2026-12");
assert.ok(isDue(new Date("2026-12-01T12:00:00Z"), new Date("2026-12-01T12:00:00Z")));
assert.ok(!isDue(new Date("2026-12-01T12:00:00Z"), new Date("2026-12-01T11:59:00Z")));
assert.ok(!isDue(null, new Date()));
const runner = readFileSync("src/lib/reports/build-monthly.ts", "utf8");
assert.ok(runner.indexOf("updateMany") < runner.indexOf("buildMonthlyReportFor(prisma, { clientId: schedule.clientId"), "a schedule is claimed before it runs (no double build)");
assert.match(runner, /where: \{ id: schedule\.id, nextRunAt: schedule\.nextRunAt, status: "active_internal" \}/);
assert.doesNotMatch(runner, /sendEmail|resend|nodemailer|fetch\(/i, "the automatic report sends no email");
const cron = readFileSync("src/app/api/cron/monthly-reports/route.ts", "utf8");
assert.ok(cron.indexOf("cronAuthorized(") < cron.indexOf("runDueMonthlySchedules("), "the cron route checks the secret first");
assert.match(readFileSync(".github/workflows/production-scheduler.yml", "utf8"), /\/api\/cron\/monthly-reports/);
const scheduleAction = readFileSync("src/app/dashboard/reports/schedules/actions.ts", "utf8");
assert.match(scheduleAction, /const clientId = access\.activeClientId/);
assert.match(scheduleAction, /hasEffectivePermission\(access, "create_content"\)/);
assert.doesNotMatch(readFileSync("src/lib/dashboard/dashboard-config.ts", "utf8"), /"\/dashboard\/reports\/schedules",\n/, "scheduled reports are no longer staff-only");

const metricsPage = readFileSync("src/app/dashboard/reports/metrics/page.tsx", "utf8");
assert.match(metricsPage, /clientId: access\.activeClientId/, "metrics are read for the active workspace only");
assert.doesNotMatch(metricsPage, /foundation-only|Foundation"|Phase \d/);
assert.doesNotMatch(readFileSync("src/lib/dashboard/dashboard-config.ts", "utf8"), /"\/dashboard\/reports\/metrics",\n/, "report metrics are no longer staff-only");

console.log("report builder: ok (months, plan, empty month, action guards, automatic monthly schedule)");
