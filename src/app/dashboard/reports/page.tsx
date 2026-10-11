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

export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ delivery?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.delivery) ? params.delivery[0] : params.delivery;
  const data = await getReportsOverviewData();
  const canExport = data.source === "database";
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
        subtitle="Client reports for this workspace. A PDF stays private, and delivery stays inside the dashboard."
        badges={[{ label: "PDF" }, { label: "In-dashboard delivery" }]}
      />

      {raw === "sent" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Rapport remis dans le tableau de bord. Aucun courriel n&apos;a été envoyé.
        </p>
      ) : null}
      {raw === "already" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Ce rapport est déjà remis dans le tableau de bord.
        </p>
      ) : null}
      {raw === "refused" || raw === "denied" || raw === "unavailable" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Ce rapport ne peut pas être remis depuis cet espace.
        </p>
      ) : null}

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
          {data.drafts.map((d) => <ReportDraftCard key={d.id} draft={d} canExport={canExport} />)}
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
