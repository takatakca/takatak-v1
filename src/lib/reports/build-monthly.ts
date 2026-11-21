import "server-only";

// Builds (or rebuilds) one workspace's monthly report from its own records,
// and delivers it inside the dashboard. Used by the report builder screen and
// by the automatic monthly schedule. Nothing is emailed.
import type { PrismaClient } from "@prisma/client";

import { getGrowthReport } from "@/lib/growth/report";

import { monthlyReportPlan, REPORT_BUILDER_SOURCE } from "./monthly-builder";
import { internalReportPath } from "./export-document";
import { isDue, MONTHLY_SCHEDULE_SOURCE, monthCoveredBy, nextMonthlyRun } from "./monthly-schedule";

export async function buildMonthlyReportFor(
  prisma: PrismaClient,
  input: { clientId: string; month: string; actorId: string | null; trigger: "builder" | "schedule" },
): Promise<string | null> {
  const growth = await getGrowthReport(input.clientId, input.month);
  if (!growth) return null;
  const plan = monthlyReportPlan(growth);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.report.findFirst({
      where: {
        clientId: input.clientId,
        type: "monthly_business",
        AND: [
          { metadata: { path: ["source"], equals: REPORT_BUILDER_SOURCE } },
          { metadata: { path: ["month"], equals: plan.metadata.month } },
        ],
      },
      select: { id: true },
    });
    const data = {
      title: plan.title,
      summary: plan.summary,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      status: "ready" as const,
      metadata: { ...plan.metadata, builtBy: input.actorId, trigger: input.trigger, builtAt: new Date().toISOString() },
    };
    const report = existing
      ? await tx.report.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.report.create({ data: { ...data, clientId: input.clientId, type: "monthly_business" }, select: { id: true } });
    if (existing) {
      await tx.reportMetric.deleteMany({ where: { reportId: report.id } });
      await tx.reportSection.deleteMany({ where: { reportId: report.id } });
    }
    for (const section of plan.sections) {
      await tx.reportSection.create({
        data: { reportId: report.id, title: section.title, type: section.type, order: section.order, content: section.content, status: "ready" },
      });
    }
    await tx.reportMetric.createMany({
      data: plan.metrics.map((metric) => ({
        reportId: report.id,
        key: metric.key,
        label: metric.label,
        value: metric.value,
        unit: metric.unit,
        source: "internal" as const,
        metadata: { month: plan.metadata.month },
      })),
    });
    return report.id;
  });
}

/** Delivers a report inside the dashboard (share record + notification), once. */
async function deliverInDashboard(prisma: PrismaClient, clientId: string, reportId: string, title: string): Promise<void> {
  const already = await prisma.reportShare.findFirst({
    where: { reportId, clientId, status: { in: ["ready_to_share", "shared_internal"] } },
    select: { id: true },
  });
  if (already) return;
  await prisma.$transaction(async (tx) => {
    await tx.reportShare.create({ data: { reportId, clientId, status: "shared_internal", shareUrl: internalReportPath(reportId) } });
    await tx.notification.create({
      data: {
        clientId,
        type: "report_ready",
        title: "Rapport mensuel prêt · Monthly report ready",
        message: `${title} est disponible dans le tableau de bord. Aucun courriel n'a été envoyé.`.slice(0, 500),
        relatedEntityType: "report",
        relatedEntityId: reportId,
      },
    });
  });
}

/**
 * Runs the automatic monthly reports that are due, oldest first. Each
 * schedule is claimed by moving its next run forward first, so two ticks (the
 * scheduler and a page visit) never build the same month twice.
 */
export async function runDueMonthlySchedules(
  prisma: PrismaClient,
  options: { clientId?: string; now?: Date; max?: number } = {},
): Promise<Array<{ scheduleId: string; reportId: string | null; month: string }>> {
  const now = options.now ?? new Date();
  const due = await prisma.reportSchedule.findMany({
    where: {
      ...(options.clientId ? { clientId: options.clientId } : {}),
      status: "active_internal",
      frequency: "monthly",
      nextRunAt: { lte: now },
      metadata: { path: ["source"], equals: MONTHLY_SCHEDULE_SOURCE },
    },
    orderBy: { nextRunAt: "asc" },
    take: options.max ?? 5,
    select: { id: true, clientId: true, nextRunAt: true },
  });
  const results: Array<{ scheduleId: string; reportId: string | null; month: string }> = [];
  for (const schedule of due) {
    if (!isDue(schedule.nextRunAt, now) || !schedule.nextRunAt) continue;
    const claimed = await prisma.reportSchedule.updateMany({
      where: { id: schedule.id, nextRunAt: schedule.nextRunAt, status: "active_internal" },
      data: { nextRunAt: nextMonthlyRun(now), lastRunAt: now },
    });
    if (claimed.count !== 1) continue;
    const month = monthCoveredBy(schedule.nextRunAt);
    try {
      const reportId = await buildMonthlyReportFor(prisma, { clientId: schedule.clientId, month, actorId: null, trigger: "schedule" });
      if (reportId) {
        const report = await prisma.report.findUnique({ where: { id: reportId }, select: { title: true } });
        await deliverInDashboard(prisma, schedule.clientId, reportId, report?.title ?? "Rapport mensuel");
      }
      results.push({ scheduleId: schedule.id, reportId, month });
    } catch {
      console.error("[reports] automatic monthly report failed");
      results.push({ scheduleId: schedule.id, reportId: null, month });
    }
  }
  return results;
}
