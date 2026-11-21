import Link from "next/link";
import { CalendarClock, FileBarChart2, FileCheck2, FileText, LayoutTemplate } from "lucide-react";
import { ReportBoundaryWarning } from "@/components/reports/report-boundary-warning";
import { ReportDraftCard } from "@/components/reports/report-draft-card";
import { ReportHeader } from "@/components/reports/report-header";
import { ReportKpiCard } from "@/components/reports/report-kpi-card";
import { ReportMetricList } from "@/components/reports/report-metric-list";
import { ReportScheduleCard } from "@/components/reports/report-schedule-card";
import { ReportSourceBanner } from "@/components/reports/source-banner";
import { ReportTemplateCard } from "@/components/reports/report-template-card";
import { getPrisma } from "@/lib/db/prisma";
import { runDueMonthlySchedules } from "@/lib/reports/build-monthly";
import { getReportsOverviewData } from "@/lib/reports/reporting-data";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

export default async function ReportsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ delivery?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.delivery) ? params.delivery[0] : params.delivery;
  // Catch-up: an automatic monthly report that came due is built on the next visit.
  const { access } = await getServerAccessContext();
  const prisma = getPrisma();
  if (access.mode === "client_scoped" && prisma) {
    await runDueMonthlySchedules(prisma, { clientId: access.activeClientId, max: 1 }).catch(() => []);
  }
  const data = await getReportsOverviewData();
  const canExport = data.source === "database";
  const kpis = [
    { label: "Rapports · Reports", value: data.kpis.reports, icon: FileText },
    { label: "Modèles · Templates", value: data.kpis.templates, icon: LayoutTemplate },
    { label: "Brouillons · Drafts", value: data.kpis.draftReports, icon: FileBarChart2 },
    { label: "Prêts · Ready", value: data.kpis.readyReports, icon: FileCheck2 },
    { label: "Planifiés · Scheduled", value: data.kpis.scheduledReports, icon: CalendarClock },
  ];
  return (
    <div className="space-y-6">
      <ReportHeader
        title="Rapports · Reports"
        subtitle="Les rapports de cet espace : PDF privé et remise dans le tableau de bord · This workspace's reports: private PDF and in-dashboard delivery."
        badges={[{ label: "PDF" }, { label: "Remise dans le tableau de bord · In-dashboard delivery" }]}
        actions={
          <Link href="/dashboard/reports/builder" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
            Bâtir un rapport mensuel · Build a monthly report
          </Link>
        }
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
        <h2 className="text-sm font-semibold text-slate-900">Modèles · Templates</h2>
        <div className="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
          {data.templates.map((t) => <ReportTemplateCard key={t.id} template={t} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Recent drafts">
        <h2 className="text-sm font-semibold text-slate-900">Rapports récents · Recent reports</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.drafts.map((d) => <ReportDraftCard key={d.id} draft={d} canExport={canExport} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Metrics snapshot">
        <h2 className="text-sm font-semibold text-slate-900">Indicateurs · Metrics</h2>
        <ReportMetricList metrics={data.metrics} />
      </section>

      <section className="space-y-3" aria-label="Schedules">
        <h2 className="text-sm font-semibold text-slate-900">Rapports planifiés · Scheduled reports</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.schedules.map((s) => <ReportScheduleCard key={s.id} schedule={s} />)}
        </div>
      </section>

      <ReportBoundaryWarning />
    </div>
  );
}
