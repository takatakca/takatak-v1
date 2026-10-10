import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GrowthReportView } from "@/components/growth/growth-report-view";
import { getGrowthReport } from "@/lib/growth/report";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rapport de croissance TAKATAK", robots: { index: false, follow: false } };

/** Chrome-free, print-ready version of the monthly report (use the browser's "Save as PDF"). */
export default async function PrintableGrowthReport({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const month = (await searchParams).month;
  const access = await requireWorkspacePermission("view_reports", `/dashboard/growth/report${month ? `?month=${encodeURIComponent(month)}` : ""}`);
  const report = await getGrowthReport(access.activeClientId, month);
  if (!report) notFound();
  return (
    <main className="mx-auto w-full max-w-4xl bg-white p-8 print:p-0">
      <GrowthReportView report={report} />
    </main>
  );
}
