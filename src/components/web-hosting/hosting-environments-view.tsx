"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  displayHostingStatus,
  usageNumber,
  usagePair,
  usageString,
} from "@/lib/web-hosting/display";
import type { HostingServiceSummary, SslCertificateSummary } from "@/lib/web-hosting/types";
import { pricing } from "@/lib/website/pricing";
import { SSL_STATUS_LABELS } from "@/lib/web-hosting/status";

function catalogName(planName: string): string {
  const lower = planName.toLowerCase();
  return (
    pricing.hosting.find((plan) => lower.includes(plan.key) || lower.includes(plan.name.toLowerCase()))
      ?.name ?? planName
  );
}

function envStatus(service: HostingServiceSummary): { label: string; className: string } {
  if (service.serverStatus === "healthy" || service.status === "active_internal") {
    return { label: "Healthy", className: "bg-emerald-50 text-emerald-700" };
  }
  if (service.serverStatus === "warning") {
    return { label: "Attention", className: "bg-amber-50 text-amber-700" };
  }
  if (service.serverStatus === "error" || service.status === "failed") {
    return { label: "Alert", className: "bg-rose-50 text-rose-700" };
  }
  if (service.status === "pending_setup") {
    return { label: "Staging", className: "bg-blue-50 text-blue-700" };
  }
  return { label: displayHostingStatus(service.status).label, className: "bg-slate-100 text-slate-500" };
}

function MiniBar({ value }: { value: number | null }) {
  const tone =
    value == null ? "bg-slate-200" : value >= 75 ? "bg-amber-500" : value >= 50 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="flex min-w-[72px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value == null ? 0 : Math.min(value, 100)}%` }} />
      </div>
      <span className={`text-xs font-medium ${value != null && value >= 75 ? "text-amber-600" : "text-slate-600"}`}>
        {value == null ? "—" : `${value}%`}
      </span>
    </div>
  );
}

export function HostingEnvironmentsView({
  services,
  certificates,
  sourceLabel,
}: {
  services: HostingServiceSummary[];
  certificates: SslCertificateSummary[];
  sourceLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(services[0]?.id ?? null);

  const plans = useMemo(
    () => Array.from(new Set(services.map((service) => catalogName(service.planName)))),
    [services],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return services.filter((service) => {
      const status = envStatus(service);
      const plan = catalogName(service.planName);
      const matchesQuery =
        !query ||
        (service.primaryDomain ?? "").toLowerCase().includes(query) ||
        service.planName.toLowerCase().includes(query) ||
        (service.brandName ?? "").toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || status.label.toLowerCase() === statusFilter;
      const matchesPlan = planFilter === "all" || plan === planFilter;
      return matchesQuery && matchesStatus && matchesPlan;
    });
  }, [services, search, statusFilter, planFilter]);

  const selected = services.find((service) => service.id === selectedId) ?? services[0] ?? null;
  const selectedStatus = selected ? envStatus(selected) : null;
  const selectedSsl = selected
    ? certificates.find((certificate) => certificate.domainName === selected.primaryDomain)
    : null;
  const alerts = services.filter(
    (service) => service.serverStatus === "warning" || service.serverStatus === "error",
  );
  const hosted = services.filter((service) => service.primaryDomain).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">Web & Domain &gt; Hosting Overview</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hosting Overview</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Monitor websites, environments, resources, deployments, backups and infrastructure health from one
            client-safe workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800">
            Run Health Check
          </button>
          <button type="button" className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white">
            Add Hosting
          </button>
          <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800">
            Actions <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Metric label="Hosted Websites" value={String(hosted)} hint={`${hosted} production`} />
        <Metric label="Uptime" value="—" hint="Observed availability is not connected" />
        <Metric
          label="Resource Alerts"
          value={String(alerts.length)}
          hint={alerts.length ? `${alerts.length} tracked warning/error` : "No telemetry alerts"}
          tone={alerts.length ? "warn" : undefined}
        />
        <Metric label="Backup Coverage" value="—" hint="Backups are not connected" />
        <Metric
          label="Open Incidents"
          value={String(services.filter((service) => service.serverStatus === "error").length)}
          hint="From server status only"
        />
        <Metric label="Deployments" value="—" hint="Deploy history is not connected" />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search website or environment..."
          className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        />
        <select className="h-9 rounded-lg border border-slate-200 px-3 text-sm">
          <option>All environments</option>
        </select>
        <select className="h-9 rounded-lg border border-slate-200 px-3 text-sm">
          <option>All providers</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="healthy">Healthy</option>
          <option value="attention">Attention</option>
          <option value="alert">Alert</option>
          <option value="staging">Staging</option>
        </select>
        <select
          value={planFilter}
          onChange={(event) => setPlanFilter(event.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All plans</option>
          {plans.map((plan) => (
            <option key={plan} value={plan}>{plan}</option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap gap-1">
          {["Deployments", "Backups", "Incidents", "Usage Report", "Export"].map((label) => (
            <span key={label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Hosting Environments</h3>
            <p className="text-xs text-slate-400">Production and staging inventory from tracked hosting records.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-y border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2">Website</th>
                  <th className="px-3 py-2">Env</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Uptime</th>
                  <th className="px-3 py-2">CPU</th>
                  <th className="px-3 py-2">Mem</th>
                  <th className="px-3 py-2">Storage</th>
                  <th className="px-3 py-2">Deploy</th>
                  <th className="px-3 py-2">Backup</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((service) => {
                  const status = envStatus(service);
                  const cpu = usageNumber(service.usageSummary, ["cpu"]);
                  const mem = usageNumber(service.usageSummary, ["memory"]);
                  const storage = usagePair(
                    service.usageSummary,
                    ["diskUsed", "storageUsed", "storage"],
                    ["diskTotal", "storageTotal"],
                  )?.percent ?? usageNumber(service.usageSummary, ["disk", "storage"]);
                  const active = service.id === selected?.id;
                  return (
                    <tr
                      key={service.id}
                      onClick={() => setSelectedId(service.id)}
                      className={`cursor-pointer border-b border-slate-100 ${active ? "bg-violet-50/70" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {service.primaryDomain ?? service.brandName ?? service.planName}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {service.status === "pending_setup" ? "Staging" : "Prod"}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{catalogName(service.planName)}</td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td className="px-3 py-3"><MiniBar value={cpu} /></td>
                      <td className="px-3 py-3"><MiniBar value={mem} /></td>
                      <td className="px-3 py-3"><MiniBar value={storage} /></td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td className="px-3 py-3 text-slate-400">—</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/dashboard/web-hosting/environments?env=${service.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-sm font-medium text-blue-600"
                        >
                          {status.label === "Alert" || status.label === "Attention" ? "Review" : "Manage"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-8 text-sm text-slate-400">
                      No hosting environments yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-400">Selected Environment</p>
              <p className="text-sm font-semibold text-slate-900">
                {selected ? `${selected.primaryDomain ?? selected.planName} — Production` : "None"}
              </p>
            </div>
            {selectedStatus ? (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${selectedStatus.className}`}>
                {selectedStatus.label}
              </span>
            ) : null}
          </div>
          {selected ? (
            <>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Provider" value="TakaTak Managed" />
                <Row
                  label="Region"
                  value={usageString(selected.usageSummary, ["dataCenter", "region", "location"]) ?? "—"}
                />
                <Row label="Runtime" value="—" />
                <Row label="Database" value="—" />
                <Row label="CDN / Cache" value="—" />
                <Row
                  label="SSL"
                  value={
                    selectedSsl
                      ? SSL_STATUS_LABELS[selectedSsl.status] ?? selectedSsl.status
                      : "—"
                  }
                />
                <Row label="Last deploy" value="—" />
                <Row label="Last backup" value="—" />
              </dl>
              <div className="mt-4 space-y-3">
                <Gauge label="CPU" value={usageNumber(selected.usageSummary, ["cpu"])} />
                <Gauge label="Memory" value={usageNumber(selected.usageSummary, ["memory"])} />
                <Gauge
                  label="Storage"
                  value={
                    usagePair(
                      selected.usageSummary,
                      ["diskUsed", "storageUsed", "storage"],
                      ["diskTotal", "storageTotal"],
                    )?.percent ?? usageNumber(selected.usageSummary, ["disk", "storage"])
                  }
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={`/dashboard/web-hosting/environments?env=${selected.id}`}
                  className="rounded-lg bg-slate-900 py-2 text-center text-sm font-medium text-white"
                >
                  Open Environment
                </Link>
                <button type="button" className="rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-400">
                  View Logs
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Select an environment from the table.</p>
          )}
        </article>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Capacity & Limits</h3>
          <p className="mt-3 text-sm text-slate-400">
            Peak CPU, memory, and storage appear when hosting telemetry is connected.
          </p>
        </article>
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Reliability & Operations</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex justify-between"><span>Incidents</span><span className="text-slate-400">Not connected</span></li>
            <li className="flex justify-between"><span>Backups</span><span className="text-slate-400">Not connected</span></li>
            <li className="flex justify-between"><span>Restore tests</span><span className="text-slate-400">Not connected</span></li>
            <li className="flex justify-between"><span>Deployments</span><span className="text-slate-400">Not connected</span></li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
              Open Operations
            </button>
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">
              Restore Tests
            </button>
          </div>
        </article>
        <article className="rounded-2xl bg-violet-50 p-5">
          <h3 className="text-sm font-semibold text-violet-950">TakaTak AI Hosting Assistant</h3>
          <p className="mt-2 text-sm text-violet-800">
            Live analysis appears after hosting telemetry is connected. Nothing is inferred from placeholder records.
          </p>
          {alerts.length ? (
            <p className="mt-2 text-sm text-violet-900">
              {alerts.length} environment{alerts.length === 1 ? "" : "s"} currently report a warning or error status.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white">
              Review Actions
            </button>
            <button type="button" className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-800">
              Run Diagnostics
            </button>
            <button type="button" className="rounded-lg px-3 py-1.5 text-xs font-medium text-violet-700">
              Dismiss
            </button>
          </div>
        </article>
      </section>
      <p className="text-[11px] text-slate-400">{sourceLabel}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "warn";
}) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-600" : "text-slate-900"}`}>{value}</p>
      <p className={`mt-1 text-[11px] ${tone === "warn" ? "text-amber-600" : "text-slate-400"}`}>{hint}</p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function Gauge({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{value == null ? "—" : `${value}%`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${value == null ? 0 : Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}