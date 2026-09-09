import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { HostingServiceSummary, SslCertificateSummary } from "@/lib/web-hosting/types";
import { HOSTING_STATUS_LABELS, SERVER_STATUS_LABELS, SSL_STATUS_LABELS } from "@/lib/web-hosting/status";

const TABS = [
  "Overview",
  "Deployments",
  "Runtime",
  "Database",
  "Backups",
  "Logs",
  "Domains & SSL",
  "CDN & Cache",
  "Env Vars",
  "Monitoring",
  "History",
];

function healthLabel(serverStatus: string): { label: string; className: string } {
  if (serverStatus === "healthy") return { label: "Healthy", className: "border-emerald-200 text-emerald-700" };
  if (serverStatus === "warning") return { label: "Warning", className: "border-amber-200 text-amber-700" };
  if (serverStatus === "error") return { label: "Error", className: "border-rose-200 text-rose-700" };
  return { label: SERVER_STATUS_LABELS[serverStatus] ?? serverStatus, className: "border-slate-200 text-slate-600" };
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
    </article>
  );
}

export function HostingEnvironmentView({
  service,
  certificate,
  sourceLabel,
}: {
  service: HostingServiceSummary;
  certificate: SslCertificateSummary | null;
  sourceLabel: string;
}) {
  const domain = service.primaryDomain ?? "Unassigned domain";
  const health = healthLabel(service.serverStatus);
  const sslLabel = certificate ? SSL_STATUS_LABELS[certificate.status] ?? certificate.status : "No certificate";
  const sslOk = certificate?.status === "valid";
  const usage = service.usageSummary ?? {};
  const cpu = typeof usage.cpu === "number" ? `${usage.cpu}%` : "—";
  const memory = typeof usage.memory === "number" ? `${usage.memory}%` : "—";
  const storage = typeof usage.storage === "number" ? `${usage.storage}%` : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <Link href="/dashboard/web-hosting/environments" className="hover:text-slate-600">
              Hosting
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span>{domain}</span>
            <ChevronRight className="h-3 w-3" />
            <span>Production</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              Production
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${health.className}`}>
              {health.label}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Operate one environment safely: deployments, runtime, data, backups, logs, domains, SSL, workers, CDN and
            incidents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={service.primaryDomain ? `https://${service.primaryDomain}` : undefined}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium ${
              service.primaryDomain ? "text-slate-700" : "pointer-events-none text-slate-400"
            }`}
          >
            Open Site <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button type="button" disabled className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white/70">
            Deploy
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-400"
          >
            More <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <nav className="flex gap-4 overflow-x-auto border-b border-slate-200 text-sm">
        {TABS.map((tab) => (
          <span
            key={tab}
            className={`shrink-0 pb-2 ${
              tab === "Overview"
                ? "border-b-2 border-violet-600 font-medium text-slate-900"
                : "text-slate-400"
            }`}
          >
            {tab}
          </span>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <Metric label="Availability" value="—" hint="Observed uptime is not connected" />
        <Metric
          label="Current Release"
          value={service.planName}
          hint={HOSTING_STATUS_LABELS[service.status] ?? service.status}
        />
        <Metric label="CPU" value={cpu} hint="From hosting usage, if reported" />
        <Metric label="Memory" value={memory} hint="From hosting usage, if reported" />
        <Metric label="Storage" value={storage} hint="From hosting usage, if reported" />
        <Metric
          label="Open Issues"
          value={service.serverStatus === "error" ? "1" : "0"}
          hint={service.serverStatus === "error" ? "Server reported an error" : "No active incident"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Environment Health</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {[
              { label: "Public website", detail: domain, ok: service.serverStatus === "healthy" },
              { label: "Application runtime", detail: service.planName, ok: service.status === "active_internal" },
              { label: "Database", detail: "Not connected", ok: false },
              { label: "Background workers", detail: "Not connected", ok: false },
              { label: "CDN / cache", detail: "Not connected", ok: false },
              { label: "SSL / domains", detail: sslLabel, ok: sslOk },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium text-slate-800">{row.label}</p>
                  <p className="text-xs text-slate-400">{row.detail}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    row.ok
                      ? "border-emerald-200 text-emerald-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  {row.ok ? "Healthy" : "Not connected"}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Resource Utilization</h3>
          <p className="mt-8 text-sm text-slate-400">
            CPU, memory, and storage charts appear when hosting telemetry is connected.
          </p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Latest Deployment</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Not connected
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Deploy history appears after a provider is connected.</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Database</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Not connected
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Database metrics are unavailable until hosting telemetry syncs.</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Backups & Recovery</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              Not connected
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Backup schedule appears after backups are enabled.</p>
          <Link href="/dashboard/web-hosting/backups" className="mt-4 inline-block text-sm font-medium text-violet-600">
            Manage Backups
          </Link>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Runtime & Workers</h3>
          <p className="mt-3 text-sm text-slate-400">Instance list appears when runtime telemetry is connected.</p>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Domains, SSL & CDN</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{domain}</span>
              <span className={`text-xs ${sslOk ? "text-emerald-600" : "text-slate-400"}`}>
                SSL {sslLabel}
              </span>
            </div>
          </div>
        </article>

        <article className="rounded-2xl bg-violet-50 p-5">
          <h3 className="text-sm font-semibold text-violet-900">TakaTak AI Environment Assistant</h3>
          <p className="mt-2 text-sm text-violet-800">
            Live analysis appears after hosting telemetry is connected. Nothing is inferred from placeholder records.
          </p>
        </article>
      </section>

      <p className="text-[11px] text-slate-400">{sourceLabel}</p>
    </div>
  );
}

export function HostingServicePicker({ services }: { services: HostingServiceSummary[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Hosting</h2>
        <p className="mt-1 text-sm text-slate-500">Choose an environment to operate.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/dashboard/web-hosting/environments?env=${service.id}`}
            className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:ring-1 hover:ring-violet-200"
          >
            <p className="text-sm font-semibold text-slate-900">{service.primaryDomain ?? service.planName}</p>
            <p className="mt-1 text-xs text-slate-500">{service.planName}</p>
            <p className="mt-2 text-xs text-slate-400">
              {HOSTING_STATUS_LABELS[service.status] ?? service.status} ·{" "}
              {SERVER_STATUS_LABELS[service.serverStatus] ?? service.serverStatus}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
