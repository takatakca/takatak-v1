import { Activity, Bell, Briefcase, Building2, ClipboardList, HeartPulse, PlugZap, Settings, Users } from "lucide-react";
import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminOperationCard } from "@/components/admin/admin-operation-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { AuditLogCard } from "@/components/admin/audit-log-card";
import { IntegrationEventCard } from "@/components/admin/integration-event-card";
import { JobStatusCard } from "@/components/admin/job-status-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { JOB_STATUS_LABELS, adminToneForStatus } from "@/lib/admin/status";
import { getAdminJobsData, getAdminOverviewData } from "@/lib/admin/admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const OPERATIONS = [
  { href: "/dashboard/admin/clients", title: "Clients", description: "Client accounts with brand, service, and member counts.", icon: Building2 },
  { href: "/dashboard/admin/users", title: "Users", description: "Profiles and client memberships (read-only).", icon: Users },
  { href: "/dashboard/admin/services", title: "Services", description: "Service instances across all clients.", icon: Briefcase },
  { href: "/dashboard/admin/jobs", title: "Jobs Monitor", description: "Planned jobs and logs. No worker runs them yet.", icon: Activity },
  { href: "/dashboard/admin/integration-events", title: "Integration Events", description: "Provider event log (webhooks, tests).", icon: PlugZap },
  { href: "/dashboard/admin/audit-logs", title: "Audit Logs", description: "System-internal audit trail with safe notes.", icon: ClipboardList },
  { href: "/dashboard/admin/notifications", title: "Notifications", description: "System notifications overview.", icon: Bell },
  { href: "/dashboard/admin/system-health", title: "System Health", description: "Env, auth, provider, and capability status.", icon: HeartPulse },
  { href: "/dashboard/admin/settings", title: "Settings", description: "Readiness checklists — no writes yet.", icon: Settings },
];

export default async function AdminOverviewPage() {
  const access = await requireAdminAccess();
  const data = await getAdminOverviewData();
  const jobs = await getAdminJobsData();
  const kpis = [
    { label: "Clients", value: data.kpis.clients, icon: Building2 },
    { label: "Team Members", value: data.kpis.teamMembers, icon: Users },
    { label: "Jobs", value: data.kpis.jobs, icon: Activity },
    { label: "Planned Jobs", value: data.kpis.plannedJobs, icon: Activity },
    { label: "Integration Events", value: data.kpis.integrationEvents, icon: PlugZap },
    { label: "Audit Entries", value: data.kpis.auditEntries, icon: ClipboardList },
    { label: "Unread Notifications", value: data.kpis.unreadNotifications, icon: Bell },
  ];
  return (
    <div className="space-y-6">
      <AdminHeader
        title="Admin Control Tower"
        subtitle="System operations foundation: clients, users, services, jobs, integration events, audit trail, and health — all view-only in Phase 13."
        badges={["Foundation", "View only", "No write actions"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />

      <section aria-label="Admin KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {kpis.map((k) => <AdminKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><AdminSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <section className="space-y-3" aria-label="Operations">
        <h2 className="text-sm font-semibold text-slate-900">Operations</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {OPERATIONS.map((op) => <AdminOperationCard key={op.href} {...op} />)}
        </div>
      </section>

      <Card>
        <CardHeader title="Jobs Snapshot" subtitle="Status distribution. Running is 0 because no worker exists." />
        <CardBody className="flex flex-wrap gap-2">
          {data.jobStatusCounts.map((j) => (
            <span key={j.status} className="flex items-center gap-1.5 text-xs text-slate-600">
              <Badge tone={adminToneForStatus(j.status)}>{JOB_STATUS_LABELS[j.status] ?? j.status}</Badge> ×{j.count}
            </span>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3" aria-label="Recent jobs">
        <h2 className="text-sm font-semibold text-slate-900">Recent Jobs</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {jobs.jobs.slice(0, 2).map((j) => <JobStatusCard key={j.id} job={j} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Recent audit entries">
        <h2 className="text-sm font-semibold text-slate-900">Recent Audit Entries</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.recentAudit.slice(0, 2).map((a) => <AuditLogCard key={a.id} entry={a} />)}
        </div>
      </section>

      {data.recentEvents.length ? (
        <section className="space-y-3" aria-label="Recent integration events">
          <h2 className="text-sm font-semibold text-slate-900">Recent Integration Events</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.recentEvents.map((e) => <IntegrationEventCard key={e.id} event={e} />)}
          </div>
        </section>
      ) : null}

      <AdminBoundaryWarning />
    </div>
  );
}
