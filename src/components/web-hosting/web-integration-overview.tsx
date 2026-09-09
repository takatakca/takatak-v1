import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  Download,
  Filter,
  Globe,
  Lock,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { DonutChart } from "@/components/dashboard/home/charts";
import { formatCompactNumber } from "@/components/dashboard/home/format";
import type { SslCertificateSummary, WebHostingOverviewData } from "@/lib/web-hosting/types";
import { SSL_STATUS_LABELS } from "@/lib/web-hosting/status";
import {
  daysLeft,
  displayDomainStatus,
  donutKey,
  hostingForDomain,
  sslForDomain,
} from "@/lib/web-hosting/display";

export function WebIntegrationOverview({
  data,
  certificates,
}: {
  data: WebHostingOverviewData;
  certificates: SslCertificateSummary[];
}) {
  const activeWebsites = data.hostingServices.filter(
    (service) => service.status === "active_internal" || service.status === "pending_setup",
  ).length;
  const validSsl = certificates.filter((certificate) => certificate.status === "valid").length;

  const statusCounts = {
    active: data.domains.filter((domain) => donutKey(domain.status) === "active").length,
    expiring: data.domains.filter((domain) => donutKey(domain.status) === "expiring").length,
    expired: data.domains.filter((domain) => donutKey(domain.status) === "expired").length,
    not_connected: data.domains.filter((domain) => donutKey(domain.status) === "not_connected").length,
  };
  const donutSlices = [
    { key: "active", value: statusCounts.active, color: "#22c55e" },
    { key: "expiring", value: statusCounts.expiring, color: "#f59e0b" },
    { key: "expired", value: statusCounts.expired, color: "#ef4444" },
    { key: "not_connected", value: statusCounts.not_connected, color: "#94a3b8" },
  ];

  const kpis = [
    {
      label: "Total Domains",
      value: formatCompactNumber(data.kpis.domains),
      icon: Globe,
      iconClass: "bg-violet-100 text-violet-600",
      hint: data.kpis.domains ? undefined : "No domains tracked yet",
    },
    {
      label: "Active Websites",
      value: formatCompactNumber(activeWebsites),
      icon: Server,
      iconClass: "bg-blue-100 text-blue-600",
      hint: activeWebsites ? undefined : "No hosted websites yet",
    },
    {
      label: "SSL Certificates",
      value: formatCompactNumber(certificates.length),
      icon: ShieldCheck,
      iconClass: "bg-emerald-100 text-emerald-600",
      hint: certificates.length
        ? validSsl === certificates.length
          ? "All certificates are valid"
          : `${validSsl} valid`
        : "No certificates yet",
    },
    {
      label: "Avg. Uptime",
      value: "—",
      icon: ArrowUp,
      iconClass: "bg-orange-100 text-orange-500",
      hint: "Uptime monitoring is not connected",
    },
    {
      label: "Total Traffic",
      value: "—",
      icon: ArrowDown,
      iconClass: "bg-sky-100 text-sky-600",
      hint: "Website analytics is not connected",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Web & Domain Integration</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage your websites, domains, SSL, and performance all in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/checkout"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Domain
          </Link>
          <button
            type="button"
            disabled
            className="rounded-lg bg-[#1f2125] px-4 py-2 text-sm font-medium text-white/70"
          >
            Connect Website
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article key={kpi.label} className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between">
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{kpi.value}</p>
              {kpi.hint ? <p className="mt-1 text-[11px] text-slate-400">{kpi.hint}</p> : null}
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr_0.7fr]">
        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Domain & Website Overview</h3>
          <p className="mt-8 text-sm text-slate-400">
            Traffic and page-view charts appear when website analytics is connected.
          </p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Domains Status</h3>
          <div className="mt-4 flex items-center gap-4">
            <DonutChart slices={donutSlices} totalLabel={formatCompactNumber(data.domains.length || null)} />
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Active
                </span>
                <span className="text-slate-900">{statusCounts.active}</span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Expiring soon
                </span>
                <span className="text-slate-900">{statusCounts.expiring}</span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expired
                </span>
                <span className="text-slate-900">{statusCounts.expired}</span>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Not connected
                </span>
                <span className="text-slate-900">{statusCounts.not_connected}</span>
              </li>
            </ul>
          </div>
          <Link
            href="/dashboard/web-hosting/domains"
            className="mt-4 inline-flex rounded-lg bg-[#1f2125] px-3 py-2 text-sm font-medium text-white"
          >
            Manage Domains
          </Link>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>
          <div className="mt-3 space-y-1">
            {[
              { label: "Add New Domain", icon: Plus },
              { label: "Connect Website", icon: Globe },
              { label: "Install SSL", icon: Lock },
              { label: "Domain Transfer", icon: Upload },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.label}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-400"
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">All Websites & Domains</h3>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400">
                <Search className="h-4 w-4" /> Search
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400">
                <Filter className="h-4 w-4" /> Filters
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400">
                <Download className="h-4 w-4" /> Export
              </span>
            </div>
          </div>
          {data.domains.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="px-5 pb-2 font-medium">Domain / Website</th>
                    <th className="px-3 pb-2 font-medium">Status</th>
                    <th className="px-3 pb-2 font-medium">SSL</th>
                    <th className="px-3 pb-2 font-medium">Hosting</th>
                    <th className="px-3 pb-2 font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {data.domains.map((domain) => {
                    const status = displayDomainStatus(domain.status);
                    const hosting = hostingForDomain(domain, data.hostingServices);
                    const ssl = sslForDomain(domain, certificates) ?? { status: domain.sslStatus };
                    const sslValid = ssl.status === "valid";
                    const hostingOn = hosting?.status === "active_internal";
                    return (
                      <tr key={domain.id} className="border-t border-slate-100">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-800">{domain.domainName}</p>
                          <p className="text-xs text-slate-400">{domain.brandName ?? "Unassigned brand"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Lock className={`h-3.5 w-3.5 ${sslValid ? "text-emerald-500" : "text-slate-300"}`} />
                            {SSL_STATUS_LABELS[ssl.status] ?? ssl.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Cloud className={`h-3.5 w-3.5 ${hostingOn ? "text-emerald-500" : "text-slate-300"}`} />
                            {hosting ? (hostingOn ? "Connected" : "Pending") : "None"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          <p>{domain.expiresAt ?? "—"}</p>
                          <p className="text-slate-400">{daysLeft(domain.expiresAt)}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 pb-5 text-sm text-slate-400">No domains yet. They appear here when tracked.</p>
          )}
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Recent Activity</h3>
          {data.provisioningSteps.length ? (
            <ul className="mt-3 space-y-3">
              {data.provisioningSteps.slice(0, 6).map((step) => (
                <li key={step.id} className="flex gap-2 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                  <div>
                    <p className="text-slate-800">{step.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {step.groupName}
                      {step.completedAt || step.plannedAt ? ` · ${step.completedAt ?? step.plannedAt}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No recent web activity.</p>
          )}
          <Link href="/dashboard/activity" className="mt-4 inline-block text-sm font-medium text-slate-500">
            View all activity
          </Link>
        </article>
      </section>

      <p className="text-[11px] text-slate-400">{data.sourceLabel}</p>
    </div>
  );
}
