"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Database,
  Eye,
  Globe,
  HardDrive,
  MoreHorizontal,
  Plus,
  Server,
  TrendingUp,
  X,
} from "lucide-react";
import { DonutChart, Sparkline } from "@/components/dashboard/home/charts";
import { formatCompactNumber, formatRelativeTime } from "@/components/dashboard/home/format";
import { SiteMark } from "@/components/web-hosting/web-workspace-ui";
import {
  daysLeft,
  displayHostingStatus,
  formatDateLabel,
  usageNumber,
  usagePair,
  usageString,
} from "@/lib/web-hosting/display";
import type {
  DomainSummary,
  HostingServiceSummary,
  ProvisioningStepSummary,
} from "@/lib/web-hosting/types";
import { pricing } from "@/lib/website/pricing";
import { RECOMMENDED_HOSTING_PLAN } from "@/lib/website/domain-hosting-selection";

const TABS = ["Overview", "Edit Details", "Resources", "Billing", "Security"];

const PLAN_SPECS: Record<string, string[]> = {
  portfolio: ["10 GB SSD Storage", "Shared bandwidth", "1 website", "Free SSL certificate", "Email-ready", "Standard support"],
  bronze: ["30 GB SSD Storage", "Business bandwidth", "Up to 3 websites", "Free SSL + email", "Daily backups", "Standard support"],
  silver: ["80 GB SSD Storage", "Priority bandwidth", "Up to 10 websites", "Free SSL certificate", "Daily backups + staging", "Priority support"],
  gold: ["200 GB SSD NVMe", "Unmetered bandwidth", "Unlimited websites", "Free SSL certificate", "Daily backups + staging", "Priority routing"],
};

function catalogKeyForPlan(planName: string): string | null {
  const lower = planName.toLowerCase();
  return (
    pricing.hosting.find(
      (plan) => lower.includes(plan.key) || lower.includes(plan.name.toLowerCase()),
    )?.key ?? null
  );
}

function recommendedKey(currentKeys: Set<string>): string | null {
  if (currentKeys.has("gold")) return null;
  if (currentKeys.has("silver")) return "gold";
  if (currentKeys.has("bronze")) return "silver";
  if (currentKeys.has("portfolio")) return "bronze";
  return RECOMMENDED_HOSTING_PLAN;
}

function priceLabel(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function rowStatus(service: HostingServiceSummary): {
  label: string;
  className: string;
} {
  if (service.serverStatus === "warning") {
    return { label: "Warning", className: "bg-amber-50 text-amber-600" };
  }
  if (service.serverStatus === "error") {
    return { label: "Error", className: "bg-rose-50 text-rose-600" };
  }
  const status = displayHostingStatus(service.status);
  if (status.tone === "success") return { label: "Active", className: "bg-emerald-50 text-emerald-600" };
  if (status.tone === "warning") return { label: status.label, className: "bg-amber-50 text-amber-600" };
  if (status.tone === "danger") return { label: status.label, className: "bg-rose-50 text-rose-600" };
  return { label: status.label === "Planned" ? "Not Connected" : status.label, className: "bg-slate-100 text-slate-500" };
}

function resourcePercent(service: HostingServiceSummary): number | null {
  const cpu = usageNumber(service.usageSummary, ["cpu"]);
  const memory = usageNumber(service.usageSummary, ["memory"]);
  const disk = usagePair(
    service.usageSummary,
    ["diskUsed", "storageUsed", "storage"],
    ["diskTotal", "storageTotal"],
  )?.percent;
  const values = [cpu, memory, disk].filter((value): value is number => value != null);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function StatusPill({ className, label }: { className: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <span className="mt-1.5 flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">
        <span className="truncate">{value}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </span>
    </label>
  );
}

function TextField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        readOnly
        value={value}
        className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
      />
    </label>
  );
}

function SwitchRow({ label, on, hint }: { label: string; on: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-slate-700">{label}</p>
        {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
      </div>
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full ${on ? "bg-blue-600" : "bg-slate-200"}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow ${on ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
    </div>
  );
}

function UsageBar({ value }: { value: number | null }) {
  const tone =
    value == null ? "bg-slate-200" : value >= 80 ? "bg-rose-500" : value >= 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="min-w-[100px]">
      <p className="text-xs font-medium text-slate-600">{value == null ? "—" : `${value}%`}</p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value == null ? 0 : Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

export function HostingOverview({
  services,
  domains,
  activity,
  sourceLabel,
}: {
  services: HostingServiceSummary[];
  domains: DomainSummary[];
  activity: ProvisioningStepSummary[];
  sourceLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState(TABS[1]);

  const currentPlanKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const service of services) {
      const key = catalogKeyForPlan(service.planName);
      if (key) keys.add(key);
    }
    return keys;
  }, [services]);
  const recommend = recommendedKey(currentPlanKeys);

  const rowsSource = useMemo(() => {
    const hosted = services.map((service) => ({ kind: "service" as const, service }));
    const unhosted = domains
      .filter((domain) => !services.some((service) => service.primaryDomain === domain.domainName))
      .map((domain) => ({ kind: "domain" as const, domain }));
    return [...hosted, ...unhosted];
  }, [services, domains]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rowsSource.filter((row) => {
      if (row.kind === "service") {
        const status = rowStatus(row.service);
        const matchesQuery =
          !query ||
          row.service.planName.toLowerCase().includes(query) ||
          (row.service.primaryDomain ?? "").toLowerCase().includes(query) ||
          (row.service.brandName ?? "").toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" || status.label.toLowerCase() === statusFilter;
        return matchesQuery && matchesStatus;
      }
      const matchesQuery =
        !query ||
        row.domain.domainName.toLowerCase().includes(query) ||
        (row.domain.brandName ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || statusFilter === "not connected";
      return matchesQuery && matchesStatus;
    });
  }, [rowsSource, search, statusFilter]);

  const selected = services.find((service) => service.id === selectedId) ?? null;
  const selectedStatus = selected ? rowStatus(selected) : null;
  const selectedCatalog = selected ? catalogKeyForPlan(selected.planName) : null;
  const selectedCatalogPlan = selectedCatalog
    ? pricing.hosting.find((plan) => plan.key === selectedCatalog)
    : null;
  const region = selected ? usageString(selected.usageSummary, ["dataCenter", "region", "location"]) : null;
  const diskPair = selected
    ? usagePair(selected.usageSummary, ["diskUsed", "storageUsed", "storage"], ["diskTotal", "storageTotal"])
    : null;
  const bandwidthPair = selected
    ? usagePair(selected.usageSummary, ["bandwidthUsed", "bandwidth"], ["bandwidthTotal"])
    : null;

  const activePlans = services.filter(
    (service) => service.status === "active_internal" || service.status === "pending_setup",
  ).length;
  const hostedWebsites = new Set(services.map((service) => service.primaryDomain).filter(Boolean)).size;
  const storageRollup = services
    .map((service) =>
      usagePair(service.usageSummary, ["diskUsed", "storageUsed", "storage"], ["diskTotal", "storageTotal"]),
    )
    .filter(Boolean) as { used: number; total: number; percent: number }[];
  const storage = storageRollup.length
    ? {
        used: storageRollup.reduce((sum, item) => sum + item.used, 0),
        total: storageRollup.reduce((sum, item) => sum + item.total, 0),
      }
    : null;

  const cpu = selected ? usageNumber(selected.usageSummary, ["cpu"]) : null;
  const memory = selected ? usageNumber(selected.usageSummary, ["memory"]) : null;
  const diskPct = diskPair?.percent ?? null;
  const bandwidthPct =
    bandwidthPair?.percent ?? usageNumber(selected?.usageSummary ?? null, ["bandwidthPercent"]);
  const hasResourceTelemetry = cpu != null || memory != null || diskPct != null || bandwidthPct != null;

  const kpis: {
    label: string;
    value: string;
    color: string;
    icon: typeof Server;
    iconClass: string;
  }[] = [
    {
      label: "Active Hosting Plans",
      value: formatCompactNumber(activePlans),
      color: "#8b5cf6",
      icon: Server,
      iconClass: "bg-violet-100 text-violet-600",
    },
    {
      label: "Hosted Websites",
      value: formatCompactNumber(hostedWebsites),
      color: "#22c55e",
      icon: Globe,
      iconClass: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Avg. Uptime",
      value: "—",
      color: "#3b82f6",
      icon: Activity,
      iconClass: "bg-blue-100 text-blue-600",
    },
    {
      label: "Storage Usage",
      value: storage ? `${formatCompactNumber(storage.used)} / ${formatCompactNumber(storage.total)}` : "—",
      color: "#f97316",
      icon: HardDrive,
      iconClass: "bg-orange-100 text-orange-500",
    },
    {
      label: "Monthly Visits",
      value: "—",
      color: "#14b8a6",
      icon: TrendingUp,
      iconClass: "bg-teal-100 text-teal-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Link
          href="/checkout"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Subscription
        </Link>
        <Link
          href="/checkout"
          className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm"
        >
          Upgrade Hosting
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <article
              key={kpi.label}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{kpi.value}</p>
              <div className="mt-2">
                <Sparkline values={[]} color={kpi.color} />
              </div>
            </article>
          );
        })}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">TAKATAK Hosting Packages</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pricing.hosting.map((plan) => {
            const current = currentPlanKeys.has(plan.key);
            const recommended = plan.key === recommend;
            return (
              <article
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${
                  current ? "border-blue-500" : "border-slate-200"
                }`}
              >
                {current ? (
                  <span className="absolute right-4 top-4 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Current plan
                  </span>
                ) : null}
                {recommended ? (
                  <span className="absolute right-4 top-4 rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Recommended
                  </span>
                ) : null}
                <p className="pr-24 text-sm font-semibold text-slate-900">{plan.name} Hosting</p>
                <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
                  {priceLabel(plan.amount)}
                  <span className="text-sm font-medium text-slate-400">/mo</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {(PLAN_SPECS[plan.key] ?? plan.features ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`mt-5 w-full rounded-lg py-2.5 text-sm font-medium ${
                    current
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {current ? "Current Plan" : "Choose Plan"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Hosted Websites & Servers</h3>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search websites</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search websites..."
                className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="warning">Warning</option>
              <option value="not connected">Not Connected</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-y border-slate-100 text-xs font-medium text-slate-400">
                <th className="px-5 py-3">Website</th>
                <th className="px-3 py-3">Hosting Plan</th>
                <th className="px-3 py-3">Server Location</th>
                <th className="px-3 py-3">Resource Usage</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Renewal Date</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                if (row.kind === "domain") {
                  return (
                    <tr key={row.domain.id} className="border-b border-slate-100">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <SiteMark domain={row.domain.domainName} imageUrl={row.domain.brandImageUrl} />
                          <div>
                            <p className="font-medium text-slate-800">{row.domain.domainName}</p>
                            <p className="text-xs text-slate-400">{row.domain.brandName ?? "Unassigned brand"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td className="px-3 py-3">
                        <UsageBar value={null} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill className="bg-slate-100 text-slate-500" label="Not Connected" />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-400">—</td>
                      <td className="px-3 py-3 text-slate-300">
                        <MoreHorizontal className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                }
                const service = row.service;
                const status = rowStatus(service);
                const usage = resourcePercent(service);
                const location = usageString(service.usageSummary, ["dataCenter", "region", "location"]);
                const catalog = catalogKeyForPlan(service.planName);
                const catalogPlan = catalog ? pricing.hosting.find((plan) => plan.key === catalog) : null;
                const remaining = daysLeft(service.renewalDate);
                const active = service.id === selectedId;
                return (
                  <tr
                    key={service.id}
                    onClick={() => {
                      setSelectedId(service.id);
                      setTab("Edit Details");
                    }}
                    className={`cursor-pointer border-b border-slate-100 ${
                      active ? "bg-blue-50/70" : "hover:bg-slate-50/80"
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <SiteMark domain={service.primaryDomain ?? service.planName} />
                        <div>
                          <p className="font-medium text-slate-800">
                            {service.primaryDomain ?? service.brandName ?? service.planName}
                          </p>
                          <p className="text-xs text-slate-400">{service.brandName ?? "Unassigned brand"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {catalogPlan ? `${catalogPlan.name} Hosting` : service.planName}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{location ?? "—"}</td>
                    <td className="px-3 py-3">
                      <UsageBar value={usage} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill className={status.className} label={status.label} />
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <p className="text-slate-700">{formatDateLabel(service.renewalDate)}</p>
                      <p
                        className={
                          remaining !== "—" && remaining !== "Expired" && Number.parseInt(remaining, 10) < 60
                            ? "text-rose-500"
                            : "text-slate-400"
                        }
                      >
                        {remaining === "—" ? "" : `(${remaining})`}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 text-slate-400">
                        <button type="button" className="rounded-md p-1 hover:bg-white hover:text-slate-700" aria-label="View">
                          <Eye className="h-4 w-4" />
                        </button>
                        <span className="rounded-md p-1">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-sm text-slate-400">
                    No hosted websites yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Resource Usage Overview</h3>
          <div className="mt-4 flex items-center gap-4">
            <DonutChart
              caption="Total Usage"
              totalLabel={hasResourceTelemetry ? `${diskPct ?? cpu ?? memory ?? 0}%` : "—"}
              slices={
                hasResourceTelemetry
                  ? [
                      { key: "cpu", value: cpu ?? 0, color: "#3b82f6" },
                      { key: "ram", value: memory ?? 0, color: "#22c55e" },
                      { key: "storage", value: diskPct ?? 0, color: "#8b5cf6" },
                      { key: "bandwidth", value: bandwidthPct ?? 0, color: "#f97316" },
                    ]
                  : []
              }
            />
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "CPU", color: "bg-blue-500", value: cpu },
                { label: "RAM", color: "bg-emerald-500", value: memory },
                { label: "Storage", color: "bg-violet-500", value: diskPct },
                { label: "Bandwidth", color: "bg-orange-500", value: bandwidthPct },
              ].map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-6 text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="font-medium text-slate-800">
                    {item.value != null ? `${item.value}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Server Health (Uptime)</h3>
          <p className="mt-1 text-xs text-slate-400">Overall Uptime —</p>
          <svg viewBox="0 0 320 140" className="mt-3 h-36 w-full" aria-hidden="true">
            <path d="M8 110 H312" fill="none" stroke="#eef0f3" strokeWidth="1" />
            <path d="M8 70 H312" fill="none" stroke="#eef0f3" strokeWidth="1" />
            <path d="M8 30 H312" fill="none" stroke="#eef0f3" strokeWidth="1" />
            <path d="M8 90 C 80 88, 140 86, 312 84" fill="none" stroke="#3b82f6" strokeOpacity="0.25" strokeWidth="2" />
          </svg>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Recent Hosting Activity</h3>
          {activity.length ? (
            <ul className="mt-4 space-y-3">
              {activity.slice(0, 6).map((step) => (
                <li key={step.id} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Database className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-slate-800">{step.title}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatRelativeTime(step.completedAt ?? step.startedAt ?? step.plannedAt) || step.groupName}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-400">No recent hosting activity.</p>
          )}
        </article>
      </section>

      <p className="text-[11px] text-slate-400">{sourceLabel}</p>

      {selected && selectedStatus ? (
        <HostingDrawer
          title={selectedCatalogPlan ? `${selectedCatalogPlan.name} Hosting` : selected.planName}
          badge={<StatusPill className={selectedStatus.className} label={selectedStatus.label} />}
          tab={tab}
          onTab={setTab}
          onClose={() => setSelectedId(null)}
        >
          {tab === "Overview" ? (
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                <span className="text-xs text-slate-400">Brand</span>
                <br />
                {selected.brandName ?? "Unassigned"}
              </p>
              <p>
                <span className="text-xs text-slate-400">Plan</span>
                <br />
                {selected.planName}
              </p>
              <p>
                <span className="text-xs text-slate-400">Renewal</span>
                <br />
                {formatDateLabel(selected.renewalDate)}
              </p>
            </div>
          ) : null}

          {tab === "Edit Details" ? (
            <div className="grid gap-6 xl:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <TextField
                  label="Subscription Name"
                  value={selectedCatalogPlan ? `${selectedCatalogPlan.name} Hosting` : selected.planName}
                />
                <SelectField label="Plan Type" value={selectedCatalogPlan?.name ?? selected.planName} />
                <SelectField label="Linked Website" value={selected.primaryDomain ?? "—"} />
                <SelectField label="Server Region" value={region ?? "—"} />
                <SelectField label="Billing Cycle" value="Monthly" />
                <TextField label="Renewal Date" value={formatDateLabel(selected.renewalDate)} />
                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Storage Limit"
                    value={diskPair ? `${formatCompactNumber(diskPair.total)}` : "—"}
                  />
                  <TextField
                    label="Bandwidth Limit"
                    value={bandwidthPair ? `${formatCompactNumber(bandwidthPair.total)}` : "—"}
                  />
                </div>
                <div className="divide-y divide-slate-100">
                  <SwitchRow label="Enabled" on={selected.status === "active_internal"} />
                  <SwitchRow label="Staging Environment" on={false} />
                </div>
                <label className="block text-xs font-medium text-slate-500">
                  Notes
                  <textarea
                    readOnly
                    rows={3}
                    placeholder="Add internal notes"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                  <span className="mt-1 block text-right text-[11px] text-slate-400">0/500</span>
                </label>
              </div>
              <aside className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">Current Plan</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedCatalogPlan ? `${selectedCatalogPlan.name} Hosting` : selected.planName}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedCatalogPlan ? `${priceLabel(selectedCatalogPlan.amount)}/mo` : "—"}
                </p>
                <div className="mt-3">
                  <StatusPill className={selectedStatus.className} label={selectedStatus.label} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Next renewal
                  <br />
                  <span className="font-medium text-slate-800">{formatDateLabel(selected.renewalDate)}</span>
                </p>
                <button
                  type="button"
                  className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Manage Subscription
                </button>
              </aside>
            </div>
          ) : null}

          {tab === "Resources" ? (
            <p className="text-sm text-slate-400">CPU, RAM, and disk appear when hosting telemetry is connected.</p>
          ) : null}
          {tab === "Billing" ? (
            <p className="text-sm text-slate-400">Billing appears after the hosting provider is connected.</p>
          ) : null}
          {tab === "Security" ? (
            <p className="text-sm text-slate-400">Security controls appear after hosting is provisioned.</p>
          ) : null}
        </HostingDrawer>
      ) : null}
    </div>
  );
}

function HostingDrawer({
  title,
  badge,
  tab,
  onTab,
  onClose,
  children,
}: {
  title: string;
  badge: ReactNode;
  tab: string;
  onTab: (value: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[640px] flex-col border-l border-slate-200 bg-white shadow-2xl lg:top-[72px]">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
          {badge}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-slate-200 px-5">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTab(item)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
              item === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm font-medium text-slate-500">
          Cancel
        </button>
        <button type="button" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Save Changes
        </button>
      </div>
    </aside>
  );
}