"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ChevronRight,
  Copy,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  Headphones,
  Mail,
  Monitor,
  Server,
  Settings,
  Workflow,
} from "lucide-react";
import { DonutChart } from "@/components/dashboard/home/charts";
import { formatCompactNumber } from "@/components/dashboard/home/format";
import {
  daysUntil,
  displayHostingStatus,
  formatDateLabel,
  usageNumber,
  usagePair,
  usageString,
  websitesOnHosting,
} from "@/lib/web-hosting/display";
import type { DomainSummary, HostingServiceSummary } from "@/lib/web-hosting/types";
import { pricing } from "@/lib/website/pricing";

const RANGES = ["7D", "30D", "3M", "6M", "1Y"] as const;

function catalogName(planName: string): string {
  const lower = planName.toLowerCase();
  return (
    pricing.hosting.find((plan) => lower.includes(plan.key) || lower.includes(plan.name.toLowerCase()))
      ?.name ?? planName
  );
}

function UsageTrack({
  pair,
  color,
}: {
  pair: { used: number; total: number; percent: number } | null;
  color: string;
}) {
  return (
    <div className="min-w-[120px]">
      <p className="text-xs text-slate-600">
        {pair ? `${formatCompactNumber(pair.used)} / ${formatCompactNumber(pair.total)}` : "—"}
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pair ? Math.min(pair.percent, 100) : 0}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function HostingAccountsOverview({
  services,
  domains,
  sourceLabel,
}: {
  services: HostingServiceSummary[];
  domains: DomainSummary[];
  sourceLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<(typeof RANGES)[number]>("30D");
  const [selectedId, setSelectedId] = useState<string | null>(services[0]?.id ?? null);
  const pageSize = 5;

  const plans = useMemo(
    () => Array.from(new Set(services.map((service) => catalogName(service.planName)))),
    [services],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return services.filter((service) => {
      const status = displayHostingStatus(service.status);
      const plan = catalogName(service.planName);
      const matchesQuery =
        !query ||
        service.planName.toLowerCase().includes(query) ||
        (service.primaryDomain ?? "").toLowerCase().includes(query) ||
        (service.brandName ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || status.label.toLowerCase() === statusFilter;
      const matchesPlan = planFilter === "all" || plan === planFilter;
      return matchesQuery && matchesStatus && matchesPlan;
    });
  }, [services, search, statusFilter, planFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = services.find((service) => service.id === selectedId) ?? services[0] ?? null;
  const selectedStatus = selected ? displayHostingStatus(selected.status) : null;
  const selectedUsage = selected?.usageSummary ?? null;
  const ip = usageString(selectedUsage, ["ip", "ipAddress", "ipv4"]);
  const dataCenter = usageString(selectedUsage, ["dataCenter", "region", "location"]);
  const autoRenewTracked = selectedUsage != null && typeof selectedUsage.autoRenew === "boolean";
  const autoRenew = selectedUsage?.autoRenew === true;
  const renewalHint = daysUntil(selected?.renewalDate ?? null);
  const cpu = usageNumber(selectedUsage, ["cpu"]);
  const memory = usageNumber(selectedUsage, ["memory"]);
  const diskPair = usagePair(selectedUsage, ["diskUsed", "storageUsed", "storage"], ["diskTotal", "storageTotal"]);
  const bandwidthPair = usagePair(selectedUsage, ["bandwidthUsed", "bandwidth"], ["bandwidthTotal"]);
  const diskPct = diskPair?.percent ?? usageNumber(selectedUsage, ["disk", "storage"]);
  const bandwidthPct = bandwidthPair?.percent ?? usageNumber(selectedUsage, ["bandwidthPercent"]);
  const hasTelemetry = cpu != null || memory != null || diskPct != null || bandwidthPct != null;

  const diskTotals = services
    .map((service) =>
      usagePair(service.usageSummary, ["diskUsed", "storageUsed", "storage"], ["diskTotal", "storageTotal"]),
    )
    .filter(Boolean) as { used: number; total: number; percent: number }[];
  const bandwidthTotals = services
    .map((service) => usagePair(service.usageSummary, ["bandwidthUsed", "bandwidth"], ["bandwidthTotal"]))
    .filter(Boolean) as { used: number; total: number; percent: number }[];
  const diskRollup = diskTotals.length
    ? {
        used: diskTotals.reduce((sum, item) => sum + item.used, 0),
        total: diskTotals.reduce((sum, item) => sum + item.total, 0),
      }
    : null;
  const bandwidthRollup = bandwidthTotals.length
    ? {
        used: bandwidthTotals.reduce((sum, item) => sum + item.used, 0),
        total: bandwidthTotals.reduce((sum, item) => sum + item.total, 0),
      }
    : null;
  const activeWebsites = services.reduce((sum, service) => sum + websitesOnHosting(service, domains), 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-6">
          <Kpi icon={Server} iconClass="bg-blue-100 text-blue-600" label="Total Hosting Accounts" value={String(services.length)} />
          <Kpi icon={Globe} iconClass="bg-blue-100 text-blue-600" label="Active Websites" value={String(activeWebsites)} />
          <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">Disk Usage</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {diskRollup
                ? `${formatCompactNumber(diskRollup.used)} / ${formatCompactNumber(diskRollup.total)}`
                : "—"}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{
                  width: diskRollup ? `${Math.round((diskRollup.used / diskRollup.total) * 100)}%` : "0%",
                }}
              />
            </div>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <p className="text-sm text-slate-500">Bandwidth Usage</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {bandwidthRollup
                ? `${formatCompactNumber(bandwidthRollup.used)} / ${formatCompactNumber(bandwidthRollup.total)}`
                : "—"}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: bandwidthRollup
                    ? `${Math.round((bandwidthRollup.used / bandwidthRollup.total) * 100)}%`
                    : "0%",
                }}
              />
            </div>
          </article>
          <Kpi icon={Activity} iconClass="bg-emerald-100 text-emerald-600" label="Avg. Uptime" value="—" hint="Not connected" />
          <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between">
              <p className="text-sm text-slate-500">Support Tickets</p>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Headphones className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-1 text-2xl font-semibold text-slate-900">—</p>
            <Link href="/dashboard/support" className="mt-1 inline-block text-xs font-medium text-blue-600">
              View All Tickets
            </Link>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">Hosting Performance</h3>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                {RANGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRange(item)}
                    className={`rounded-md px-2.5 py-1 ${range === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            {hasTelemetry ? (
              <svg viewBox="0 0 320 160" className="mt-4 h-40 w-full" aria-hidden="true">
                <path d="M8 140 H312" stroke="#eef0f3" />
                <path d="M8 90 H312" stroke="#eef0f3" />
                <path d="M8 40 H312" stroke="#eef0f3" />
              </svg>
            ) : (
              <p className="mt-8 text-sm text-slate-400">
                CPU, memory, and disk I/O trends appear when hosting telemetry is connected.
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> CPU Usage (%)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Memory Usage (%)</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Disk I/O</span>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">Resource Usage</h3>
            <div className="mt-4 flex items-center gap-4">
              <DonutChart
                caption="Total Used"
                totalLabel={hasTelemetry ? `${diskPct ?? cpu ?? memory ?? 0}%` : "—"}
                slices={
                  hasTelemetry
                    ? [
                        { key: "cpu", value: cpu ?? 0, color: "#3b82f6" },
                        { key: "memory", value: memory ?? 0, color: "#22c55e" },
                        { key: "disk", value: diskPct ?? 0, color: "#8b5cf6" },
                        { key: "bandwidth", value: bandwidthPct ?? 0, color: "#f97316" },
                      ]
                    : []
                }
              />
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex justify-between gap-4"><span>CPU</span>{cpu != null ? `${cpu}%` : "—"}</li>
                <li className="flex justify-between gap-4"><span>Memory</span>{memory != null ? `${memory}%` : "—"}</li>
                <li className="flex justify-between gap-4"><span>Disk</span>{diskPct != null ? `${diskPct}%` : "—"}</li>
                <li className="flex justify-between gap-4"><span>Bandwidth</span>{bandwidthPct != null ? `${bandwidthPct}%` : "—"}</li>
              </ul>
            </div>
            <Link href="/dashboard/web-hosting/environments" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600">
              View Full Resource Usage <ChevronRight className="h-4 w-4" />
            </Link>
          </article>
        </section>

        <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">My Hosting Accounts</h3>
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search hosting accounts..."
                className="h-9 w-56 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending setup">Pending setup</option>
                <option value="planned">Planned</option>
              </select>
              <select
                value={planFilter}
                onChange={(event) => {
                  setPlanFilter(event.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
              >
                <option value="all">All Plans</option>
                {plans.map((plan) => (
                  <option key={plan} value={plan}>{plan}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-xs text-slate-400">
                  <th className="px-5 py-3 font-medium">Hosting Account</th>
                  <th className="px-3 py-3 font-medium">Plan</th>
                  <th className="px-3 py-3 font-medium">Websites</th>
                  <th className="px-3 py-3 font-medium">Disk Usage</th>
                  <th className="px-3 py-3 font-medium">Bandwidth</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Renewal Date</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((service) => {
                  const status = displayHostingStatus(service.status);
                  const disk = usagePair(service.usageSummary, ["diskUsed", "storageUsed", "storage"], ["diskTotal", "storageTotal"]);
                  const bandwidth = usagePair(service.usageSummary, ["bandwidthUsed", "bandwidth"], ["bandwidthTotal"]);
                  const accountIp = usageString(service.usageSummary, ["ip", "ipAddress", "ipv4"]);
                  const active = service.id === selected?.id;
                  return (
                    <tr
                      key={service.id}
                      onClick={() => setSelectedId(service.id)}
                      className={`cursor-pointer border-b border-slate-100 ${active ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Server className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="font-medium text-slate-800">{service.brandName ?? service.planName}</p>
                            <p className="text-xs text-slate-400">
                              {service.primaryDomain ?? "No domain"}
                              {accountIp ? ` · ${accountIp}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{catalogName(service.planName)}</td>
                      <td className="px-3 py-3">{websitesOnHosting(service, domains)}</td>
                      <td className="px-3 py-3"><UsageTrack pair={disk} color="#3b82f6" /></td>
                      <td className="px-3 py-3"><UsageTrack pair={bandwidth} color="#22c55e" /></td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        <p>{formatDateLabel(service.renewalDate)}</p>
                        {daysUntil(service.renewalDate) ? (
                          <p className="text-slate-400">{daysUntil(service.renewalDate)}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-slate-400">
                          <span title="cPanel is not connected" className="rounded-md p-1 text-orange-400">
                            <Monitor className="h-4 w-4" />
                          </span>
                          <Link
                            href="/dashboard/web-hosting/environments"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-md p-1 hover:bg-white hover:text-slate-700"
                            aria-label="Open environments"
                          >
                            <Settings className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-5 py-3 text-sm text-slate-500">
            <p>
              Showing {(safePage - 1) * pageSize + (filtered.length ? 1 : 0)} to {Math.min(filtered.length, safePage * pageSize)} of {filtered.length} accounts
            </p>
            <div className="flex gap-1">
              {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  className={`h-7 min-w-7 rounded-md text-xs ${number === safePage ? "bg-slate-900 text-white" : ""}`}
                >
                  {number}
                </button>
              ))}
            </div>
          </div>
        </article>
        <p className="text-[11px] text-slate-400">{sourceLabel}</p>
      </div>

      <div className="space-y-5 xl:sticky xl:top-[88px] xl:self-start">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Hosting Account Details</h3>
            {selectedStatus ? (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${selectedStatus.className}`}>
                {selectedStatus.label}
              </span>
            ) : null}
          </div>
          {selected ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Server className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{selected.brandName ?? selected.planName}</p>
                  <p className="text-xs text-slate-400">{catalogName(selected.planName)} Plan</p>
                </div>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Detail
                  label="Primary Domain"
                  value={
                    selected.primaryDomain ? (
                      <a href={`https://${selected.primaryDomain}`} className="inline-flex items-center gap-1 text-blue-600" target="_blank" rel="noreferrer">
                        {selected.primaryDomain} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Detail
                  label="IP Address"
                  value={
                    ip ? (
                      <span className="inline-flex items-center gap-1">
                        {ip} <Copy className="h-3 w-3 text-slate-400" />
                      </span>
                    ) : (
                      "Not tracked"
                    )
                  }
                />
                <Detail label="Data Center" value={dataCenter ?? "Not tracked"} />
                <Detail label="Account Created" value={formatDateLabel(selected.createdAt)} />
                <Detail
                  label="Renewal Date"
                  value={
                    selected.renewalDate
                      ? `${formatDateLabel(selected.renewalDate)}${renewalHint ? ` (${renewalHint})` : ""}`
                      : "—"
                  }
                />
                <Detail
                  label="Auto Renewal"
                  value={
                    autoRenewTracked ? (
                      <span className={autoRenew ? "text-emerald-600" : "text-slate-500"}>{autoRenew ? "Enabled" : "Off"}</span>
                    ) : (
                      "Not tracked"
                    )
                  }
                />
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/dashboard/web-hosting/environments"
                  className="rounded-lg border border-slate-200 py-2 text-center text-sm font-medium text-slate-700"
                >
                  Manage Plan
                </Link>
                <button type="button" className="rounded-lg bg-blue-600 py-2 text-sm font-medium text-white">
                  Upgrade Plan
                </button>
              </div>
              <Link
                href="/dashboard/web-hosting/environments"
                className="mt-2 block rounded-lg bg-slate-900 py-2 text-center text-sm font-medium text-white"
              >
                Open Environment
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Hosting accounts appear here when they are tracked.</p>
          )}
        </article>
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>
          <ul className="mt-2">
            {[
              { label: "cPanel Login", href: null, icon: Monitor },
              { label: "File Manager", href: null, icon: HardDrive },
              { label: "Backup Manager", href: "/dashboard/web-hosting/backups", icon: Database },
              { label: "Email Accounts", href: "/dashboard/hosting/email", icon: Mail },
              { label: "SSL Certificates", href: "/dashboard/web-hosting/ssl", icon: Globe },
              { label: "DNS Management", href: "/dashboard/web-hosting/dns", icon: Workflow },
            ].map((action) => {
              const Icon = action.icon;
              if (!action.href) {
                return (
                  <li key={action.label} className="flex items-center gap-2 px-2 py-2 text-sm text-slate-400">
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{action.label}</span>
                    <span className="text-[11px]">Not connected</span>
                  </li>
                );
              }
              return (
                <li key={action.label}>
                  <Link href={action.href} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    <Icon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1">{action.label}</span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: typeof Server;
  iconClass: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}