"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { getGrowthReport } from "@/lib/growth/report";
import { isBuildableMonth, monthlyReportPlan, REPORT_BUILDER_SOURCE } from "@/lib/reports/monthly-builder";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const BACK = "/dashboard/reports/builder";

/**
 * Builds (or rebuilds) the monthly report of the active workspace from its
 * own records. One report per month: building the same month again refreshes
 * its numbers. Nothing is sent anywhere.
 */
export async function buildMonthlyReport(formData: FormData) {
  const month = String(formData.get("month") ?? "").trim();
  if (!isBuildableMonth(month)) redirect(`${BACK}?built=refused`);

  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") redirect(`${BACK}?built=unavailable`);
  if (!hasEffectivePermission(access, "view_reports") || !hasEffectivePermission(access, "create_content")) {
    redirect(`${BACK}?built=denied`);
  }

  const prisma = getPrisma();
  if (!prisma) redirect(`${BACK}?built=unavailable`);

  const clientId = access.activeClientId;
  let growth: Awaited<ReturnType<typeof getGrowthReport>>;
  try {
    growth = await getGrowthReport(clientId, month);
  } catch {
    redirect(`${BACK}?built=unavailable`);
  }
  if (!growth) redirect(`${BACK}?built=unavailable`);

  const plan = monthlyReportPlan(growth);
  const reportId = await prisma.$transaction(async (tx) => {
    const existing = await tx.report.findFirst({
      where: {
        clientId,
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
      metadata: { ...plan.metadata, builtBy: access.profileId ?? null, builtAt: new Date().toISOString() },
    };
    const report = existing
      ? await tx.report.update({ where: { id: existing.id }, data, select: { id: true } })
      : await tx.report.create({ data: { ...data, clientId, type: "monthly_business" }, select: { id: true } });
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

  revalidatePath("/dashboard/reports");
  redirect(`${BACK}?built=${reportId}`);
}
