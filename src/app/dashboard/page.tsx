import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/saas/status-badge";
import { JobPreview } from "@/components/dashboard/job-preview";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ServiceCard } from "@/components/dashboard/service-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { KPI_CARDS, SERVICE_MODULES } from "@/lib/dashboard/dashboard-config";
import { getDashboardOverviewData } from "@/lib/db/dashboard-data";
import { GlobalAdminViewWarning } from "@/components/security/global-admin-view-warning";
import { getServerAccessContext } from "@/lib/security/access-context";

// Always render dynamically: DB counts must be live, never baked at build.
export const dynamic = "force-dynamic";

// Dashboard Overview — Phase 4: DB-first with honest mock fallback.
// Source badge shows "Database connected" ONLY when real queries succeeded.
export default async function DashboardOverviewPage() {
  const data = await getDashboardOverviewData();
  const { access } = await getServerAccessContext();
  const kpiValues = [
    data.kpis.clients,
    data.kpis.businessBrands,
    data.kpis.activeServices,
    data.kpis.pendingJobs,
    data.kpis.reportsReady,
  ];

  return (
    <div className="space-y-6">
      {access.mode === "platform_admin" ? <GlobalAdminViewWarning /> : null}
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">TAKATAK Dashboard</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Unified control tower for clients, services, integrations, reports, and automation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">V1 Foundation</Badge>
          {data.source === "database" ? (
            <Badge tone="success">Database connected</Badge>
          ) : (
            <Badge tone="neutral">Mock data</Badge>
          )}
          <Badge tone="warning">Live integrations not connected yet</Badge>
        </div>
      </div>

      {/* KPI cards */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {KPI_CARDS.map((kpi, i) => (
            <StatCard
              key={kpi.label}
              kpi={{
                ...kpi,
                value: String(kpiValues[i]),
                hint: data.source === "database" ? "Live foundation record count" : kpi.hint,
              }}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{data.sourceLabel}</p>
      </section>

      {/* Service modules */}
      <section aria-label="Service modules" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Service Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SERVICE_MODULES.map((m) => (
            <ServiceCard key={m.slug} module={m} />
          ))}
        </div>
      </section>

      {/* Integrations + activity (source-aware) */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Status panels">
        <Card>
          <CardHeader
            title="Integration Status"
            subtitle={
              data.source === "database"
                ? "From integration_accounts — no provider is connected."
                : "No provider is connected yet — statuses are honest by design."
            }
          />
          <CardBody className="divide-y divide-slate-100 p-0">
            {data.integrations.map((row) => (
              <div key={row.name} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{row.name}</p>
                  <p className="text-[11px] text-slate-400">{row.purpose}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={row.status} />
                  <span className="text-[10px] text-slate-400">{row.actionLabel}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Activity"
            subtitle={
              data.source === "database"
                ? "Recent notifications and jobs from the database."
                : "Foundation activity — real events arrive with the jobs system."
            }
          />
          <CardBody>
            <ol className="space-y-4">
              {data.recentActivity.map((item, i) => (
                <li key={`${item.message}-${i}`} className="relative flex gap-3">
                  <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500/80" />
                    {i < data.recentActivity.length - 1 ? (
                      <span className="absolute left-1/2 top-3 h-8 w-px -translate-x-1/2 bg-slate-200" />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{item.message}</p>
                    {item.detail ? <p className="text-[11px] text-slate-400">{item.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </section>

      {/* Jobs + quick actions */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Jobs and actions">
        <JobPreview />
        <QuickActions />
      </section>
    </div>
  );
}
