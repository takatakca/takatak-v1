import Link from "next/link";

import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { GrowthReportView } from "@/components/growth/growth-report-view";
import { getGrowthReport, monthRange, previousMonth } from "@/lib/growth/report";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";

export const dynamic = "force-dynamic";

export default async function GrowthReportPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const access = await requireWorkspacePermission("view_reports", "/dashboard/growth/report");
  const month = monthRange((await searchParams).month);
  const prev = previousMonth(month);
  const next = monthRange(`${month.end.getUTCFullYear()}-${String(month.end.getUTCMonth() + 1).padStart(2, "0")}`);
  let report = null;
  try {
    report = await getGrowthReport(access.activeClientId, month.key);
  } catch {
    console.error("[growth] report unavailable");
  }
  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Monthly Growth Report"
        description="Everything TAKATAK did for this client this month: traffic, contacts, reviews, chat, leads, ads and AI work, compared with last month."
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <Link href={`?month=${prev.key}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-indigo-300">
              ← {prev.key}
            </Link>
            <Link href={`?month=${next.key}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:border-indigo-300">
              {next.key} →
            </Link>
            <a href={`/growth-report?month=${month.key}`} target="_blank" rel="noreferrer" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700">
              Printable / PDF
            </a>
          </div>
        }
      />
      {report ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <GrowthReportView report={report} />
        </div>
      ) : (
        <HonestyNote>The report data is not reachable right now.</HonestyNote>
      )}
    </div>
  );
}
