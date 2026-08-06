import { CalendarClock, FileBarChart2, FileCheck2, FileText, LayoutTemplate } from "lucide-react";
import { ReportBoundaryWarning } from "@/components/reports/report-boundary-warning";
import { ReportDraftCard } from "@/components/reports/report-draft-card";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportMetricList } from "@/components/reports/report-metric-list";
import { ReportScheduleCard } from "@/components/reports/report-schedule-card";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { ReportTemplateCard } from "@/components/reports/report-template-card";
import { getReportsOverviewData } from "@/lib/reports/reporting-data";

export const dynamic = "force-dynamic";

export default async function ReportsOverviewPage() {
  const data = await getReportsOverviewData();
  const kpis = [
    { label: "Reports", value: data.kpis.reports, icon: FileText },
    { label: "Templates", value: data.kpis.templates, icon: LayoutTemplate },
    { label: "Draft Reports", value: data.kpis.draftReports, icon: FileBarChart2 },
    { label: "Ready Reports", value: data.kpis.readyReports, icon: FileCheck2 },
    { label: "Scheduled Reports", value: data.kpis.scheduledReports, icon: CalendarClock },
  ];
  return (
    <div className="space-y-6">
      <ReportHeader
        title="Reports"
        subtitle="Build client-ready summaries from TAKATAK services before export and delivery are enabled."
        badges={[{ label: "Foundation", status: "draft" }, { label: "Export not active" }, { label: "Delivery not active" }]}
      />

      <section aria-label="Report KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => <ReportKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><ReportSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <section className="space-y-3" aria-label="Templates">
        <h2 className="text-sm font-semibold text-slate-900">Report Templates</h2>
        <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
          {data.templates.map((t) => <ReportTemplateCard key={t.id} template={t} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Recent drafts">
        <h2 className="text-sm font-semibold text-slate-900">Recent Report Drafts</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.drafts.map((d) => <ReportDraftCard key={d.id} draft={d} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Metrics snapshot">
        <h2 className="text-sm font-semibold text-slate-900">Report Metrics Snapshot</h2>
        <ReportMetricList metrics={data.metrics} />
      </section>

      <section className="space-y-3" aria-label="Schedules">
        <h2 className="text-sm font-semibold text-slate-900">Schedule Foundation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.schedules.map((s) => <ReportScheduleCard key={s.id} schedule={s} />)}
        </div>
      </section>

      <ReportBoundaryWarning />
    </div>
  );
}
