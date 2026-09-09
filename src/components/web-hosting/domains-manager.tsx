"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Eye,
  Globe,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { DonutChart, LineChart, Sparkline } from "@/components/dashboard/home/charts";
import { formatCompactNumber, formatRelativeTime } from "@/components/dashboard/home/format";
import {
  Field,
  PagePager,
  ReadOnlySwitch,
  SideDrawer,
  SiteMark,
  StatusDot,
  TextInput,
  WorkspaceToolbar,
} from "@/components/web-hosting/web-workspace-ui";
import {
  daysLeft,
  displayDomainStatus,
  dnsHealthPercent,
  dnsStatusLabel,
  donutKey,
  isExpiringSoon,
  registrarLabel,
  sslForDomain,
  websiteUrl,
} from "@/lib/web-hosting/display";
import { SSL_STATUS_LABELS } from "@/lib/web-hosting/status";
import type {
  DnsRecordSummary,
  DomainSummary,
  HostingServiceSummary,
  ProvisioningStepSummary,
  SslCertificateSummary,
} from "@/lib/web-hosting/types";

const DOMAIN_TABS = ["Overview", "Edit Details", "DNS Records", "Redirects", "Security"];

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  return new Date(`${expiresAt}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DomainsManager({
  domains,
  hosting: _hosting,
  records,
  certificates,
  activity,
  sourceLabel,
}: {
  domains: DomainSummary[];
  hosting: HostingServiceSummary[];
  records: DnsRecordSummary[];
  certificates: SslCertificateSummary[];
  activity: ProvisioningStepSummary[];
  sourceLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registrarFilter, setRegistrarFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState(DOMAIN_TABS[0]);

  const registrars = useMemo(() => {
    const values = Array.from(new Set(domains.map((domain) => domain.registrar).filter(Boolean))) as string[];
    return values;
  }, [domains]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return domains.filter((domain) => {
      const status = displayDomainStatus(domain.status);
      const matchesQuery =
        !query ||
        domain.domainName.toLowerCase().includes(query) ||
        (domain.brandName ?? "").toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        status.label.toLowerCase() === statusFilter ||
        domain.status === statusFilter;
      const matchesRegistrar = registrarFilter === "all" || domain.registrar === registrarFilter;
      return matchesQuery && matchesStatus && matchesRegistrar;
    });
  }, [domains, search, statusFilter, registrarFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = domains.find((domain) => domain.id === selectedId) ?? null;

  const activeCount = domains.filter((domain) => donutKey(domain.status) === "active").length;
  const expiringCount = domains.filter((domain) => isExpiringSoon(domain)).length;
  const health = dnsHealthPercent(domains);
  const autoRenewCount = domains.filter((domain) => domain.autoRenew).length;
  const statusCounts = {
    active: domains.filter((domain) => donutKey(domain.status) === "active").length,
    expiring: domains.filter((domain) => donutKey(domain.status) === "expiring").length,
    expired: domains.filter((domain) => donutKey(domain.status) === "expired").length,
    not_connected: domains.filter((domain) => donutKey(domain.status) === "not_connected").length,
  };

  const kpis = [
    {
      label: "Total Domains",
      value: formatCompactNumber(domains.length),
      icon: Globe,
      iconClass: "bg-violet-100 text-violet-600",
      color: "#8b5cf6",
    },
    {
      label: "Active Domains",
      value: formatCompactNumber(activeCount),
      icon: ShieldCheck,
      iconClass: "bg-emerald-100 text-emerald-600",
      color: "#22c55e",
    },
    {
      label: "Expiring Soon",
      value: formatCompactNumber(expiringCount),
      icon: CalendarClock,
      iconClass: "bg-orange-100 text-orange-500",
      color: "#f97316",
    },
    {
      label: "DNS Health",
      value: health == null ? "—" : `${health}%`,
      icon: Wifi,
      iconClass: "bg-sky-100 text-sky-600",
      color: "#0ea5e9",
      hint: domains.length ? "From tracked DNS status, not a live probe" : "No domains tracked yet",
    },
    {
      label: "Auto-Renew Enabled",
      value: formatCompactNumber(autoRenewCount),
      icon: RefreshCw,
      iconClass: "bg-teal-100 text-teal-600",
      color: "#14b8a6",
    },
  ];

  const selectedRecords = selected
    ? records.filter((record) => record.domainName === selected.domainName)
    : [];
  const selectedSsl = selected ? sslForDomain(selected, certificates) : undefined;
  const selectedStatus = selected ? displayDomainStatus(selected.status) : null;

  return (
    <div className={selected ? "lg:pr-[420px]" : undefined}>
      <div className="space-y-5">
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
                <Sparkline values={[]} color={kpi.color} />
                {kpi.hint ? <p className="text-[11px] text-slate-400">{kpi.hint}</p> : null}
              </article>
            );
          })}
        </section>

        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-5 py-4">
            <WorkspaceToolbar
              search={search}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search domains..."
              status={statusFilter}
              onStatus={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              statusOptions={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "expiring soon", label: "Expiring soon" },
                { value: "expired", label: "Expired" },
                { value: "planned", label: "Planned" },
                { value: "pending connection", label: "Pending connection" },
              ]}
              extraFilterLabel="Registrars"
              extraFilter={registrarFilter}
              onExtraFilter={(value) => {
                setRegistrarFilter(value);
                setPage(1);
              }}
              extraOptions={[
                { value: "all", label: "All Registrars" },
                ...registrars.map((registrar) => ({
                  value: registrar,
                  label: registrarLabel(registrar),
                })),
              ]}
              addLabel="Add Domain"
              addHref="/checkout"
            />
          </div>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="px-5 pb-2 font-medium">Domain</th>
                    <th className="px-3 pb-2 font-medium">Status</th>
                    <th className="px-3 pb-2 font-medium">Registrar</th>
                    <th className="px-3 pb-2 font-medium">DNS</th>
                    <th className="px-3 pb-2 font-medium">Auto-Renew</th>
                    <th className="px-3 pb-2 font-medium">Expiry Date</th>
                    <th className="px-3 pb-2 font-medium">SSL</th>
                    <th className="px-3 pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((domain) => {
                    const status = displayDomainStatus(domain.status);
                    const dns = dnsStatusLabel(domain.dnsStatus);
                    const ssl = sslForDomain(domain, certificates);
                    const sslLabel = SSL_STATUS_LABELS[ssl?.status ?? domain.sslStatus] ?? domain.sslStatus;
                    const sslOk = (ssl?.status ?? domain.sslStatus) === "valid";
                    const expirySoon = isExpiringSoon(domain);
                    const active = domain.id === selectedId;
                    return (
                      <tr
                        key={domain.id}
                        onClick={() => {
                          setSelectedId(domain.id);
                          setTab("Overview");
                        }}
                        className={`cursor-pointer border-t border-slate-100 ${
                          active ? "border-l-2 border-l-blue-500 bg-blue-50/50" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <SiteMark domain={domain.domainName} imageUrl={domain.brandImageUrl} />
                            <div>
                              <p className="font-medium text-slate-800">{domain.domainName}</p>
                              <p className="text-xs text-slate-400">{domain.brandName ?? "Unassigned brand"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusDot tone={status.tone} label={status.label} />
                        </td>
                        <td className="px-3 py-3 text-slate-600">{registrarLabel(domain.registrar)}</td>
                        <td className="px-3 py-3">
                          <StatusDot tone={dns.tone} label={dns.label} />
                        </td>
                        <td className="px-3 py-3">
                          <ReadOnlySwitch on={domain.autoRenew} />
                        </td>
                        <td className={`px-3 py-3 text-xs ${expirySoon ? "text-rose-600" : "text-slate-600"}`}>
                          <p>{formatExpiry(domain.expiresAt)}</p>
                          <p className={expirySoon ? "text-rose-500" : "text-slate-400"}>{daysLeft(domain.expiresAt)}</p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Lock className={`h-3.5 w-3.5 ${sslOk ? "text-emerald-500" : "text-slate-300"}`} />
                            {sslLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-slate-400">
                            <button type="button" className="rounded-md p-1 hover:bg-white hover:text-slate-700" aria-label="View">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button type="button" className="rounded-md p-1 hover:bg-white hover:text-slate-700" aria-label="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <span className="rounded-md p-1">
                              <MoreHorizontal className="h-4 w-4" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 pb-5 text-sm text-slate-400">
              {domains.length === 0 ? (
                <>
                  No domains yet.{" "}
                  <Link
                    href="/checkout"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Add a domain
                  </Link>{" "}
                  to search and register.
                </>
              ) : (
                "No domains match these filters."
              )}
            </p>
          )}
          <PagePager
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="domains"
          />
        </article>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">Domain Status Distribution</h3>
            <div className="mt-4 flex items-center gap-4">
              <DonutChart
                slices={[
                  { key: "active", value: statusCounts.active, color: "#22c55e" },
                  { key: "expiring", value: statusCounts.expiring, color: "#f59e0b" },
                  { key: "expired", value: statusCounts.expired, color: "#ef4444" },
                  { key: "not_connected", value: statusCounts.not_connected, color: "#94a3b8" },
                ]}
                totalLabel={formatCompactNumber(domains.length || null)}
              />
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-4 text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Active
                  </span>
                  {statusCounts.active}
                </li>
                <li className="flex justify-between gap-4 text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Expiring soon
                  </span>
                  {statusCounts.expiring}
                </li>
                <li className="flex justify-between gap-4 text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Expired
                  </span>
                  {statusCounts.expired}
                </li>
                <li className="flex justify-between gap-4 text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Not connected
                  </span>
                  {statusCounts.not_connected}
                </li>
              </ul>
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">DNS Performance</h3>
            <p className="mt-1 text-xs text-slate-400">Average propagation time</p>
            <div className="mt-3">
              <LineChart values={[]} emptyLabel="DNS monitoring is not connected" />
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">Recent Domain Activity</h3>
            {activity.length ? (
              <ul className="mt-3 space-y-3">
                {activity.slice(0, 6).map((step) => (
                  <li key={step.id} className="flex gap-2 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                    <div>
                      <p className="text-slate-800">{step.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {step.groupName}
                        {step.completedAt || step.startedAt || step.plannedAt
                          ? ` · ${formatRelativeTime(step.completedAt ?? step.startedAt ?? step.plannedAt)}`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No recent domain activity.</p>
            )}
          </article>
        </section>

        <p className="text-[11px] text-slate-400">{sourceLabel}</p>
      </div>

      {selected && selectedStatus ? (
        <SideDrawer
          title={selected.domainName}
          subtitle={websiteUrl(selected)}
          badge={
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${selectedStatus.className}`}>
              {selectedStatus.label}
            </span>
          }
          onClose={() => setSelectedId(null)}
          tabs={DOMAIN_TABS}
          activeTab={tab}
          onTab={setTab}
        >
          {tab === "Overview" ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">Domain</span>
                <br />
                {selected.domainName}
              </p>
              <p>
                <span className="text-slate-400">Registrar</span>
                <br />
                {registrarLabel(selected.registrar)}
              </p>
              <p>
                <span className="text-slate-400">Status</span>
                <br />
                {selectedStatus.label}
              </p>
              <p>
                <span className="text-slate-400">Auto-renew</span>
                <br />
                {selected.autoRenew ? "On" : "Off"}
              </p>
              <p>
                <span className="text-slate-400">Registered</span>
                <br />
                {formatExpiry(selected.createdAt)}
              </p>
              <p>
                <span className="text-slate-400">Expires</span>
                <br />
                {formatExpiry(selected.expiresAt)}
              </p>
              <p>
                <span className="text-slate-400">DNS / SSL</span>
                <br />
                {dnsStatusLabel(selected.dnsStatus).label} ·{" "}
                {SSL_STATUS_LABELS[selected.sslStatus] ?? selected.sslStatus}
              </p>
            </div>
          ) : null}

          {tab === "Edit Details" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Domain Name">
                  <TextInput value={selected.domainName} />
                </Field>
                <Field label="Primary URL">
                  <TextInput value={websiteUrl(selected)} />
                </Field>
                <Field label="Registrar">
                  <TextInput value={registrarLabel(selected.registrar)} />
                </Field>
                <Field label="Connection Status">
                  <TextInput value={selectedStatus.label} />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-700">Auto-Renew</span>
                <ReadOnlySwitch on={selected.autoRenew} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm text-slate-700">Privacy Protection</p>
                  <p className="text-[11px] text-slate-400">Not tracked yet</p>
                </div>
                <ReadOnlySwitch on={false} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nameserver 1">
                  <TextInput value="Not tracked" />
                </Field>
                <Field label="Nameserver 2">
                  <TextInput value="Not tracked" />
                </Field>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">DNS Records</p>
                {selectedRecords.length ? (
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-1 font-medium">Type</th>
                        <th className="pb-1 font-medium">Host</th>
                        <th className="pb-1 font-medium">Value</th>
                        <th className="pb-1 font-medium">TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecords.map((record) => (
                        <tr key={record.id} className="border-t border-slate-100 text-slate-700">
                          <td className="py-1.5 font-semibold">{record.type}</td>
                          <td className="py-1.5 font-mono">{record.name}</td>
                          <td className="max-w-[140px] truncate py-1.5 font-mono text-slate-500">{record.value}</td>
                          <td className="py-1.5">{record.ttl ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-slate-400">No DNS records tracked for this domain.</p>
                )}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">SSL Status</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {SSL_STATUS_LABELS[selectedSsl?.status ?? selected.sslStatus] ?? selected.sslStatus}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {selectedSsl?.expiresAt ? `Until ${formatExpiry(selectedSsl.expiresAt)}` : "No expiry tracked"}
                    </p>
                  </div>
                  <Link
                    href="/dashboard/web-hosting/ssl"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    Manage SSL
                  </Link>
                </div>
              </div>
              <Field label="Linked Website">
                <TextInput value={selected.brandName ?? "Unassigned"} />
              </Field>
              <Field label="Internal notes">
                <textarea
                  readOnly
                  rows={3}
                  placeholder="Notes are not stored until the provider is connected."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                />
              </Field>
            </div>
          ) : null}

          {tab === "DNS Records" ? (
            selectedRecords.length ? (
              <ul className="space-y-2 text-sm">
                {selectedRecords.map((record) => (
                  <li key={record.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="font-semibold text-slate-800">
                      {record.type} · {record.name}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">{record.value}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No DNS records tracked.</p>
            )
          ) : null}

          {tab === "Redirects" ? (
            <p className="text-sm text-slate-400">Redirects are not connected yet.</p>
          ) : null}

          {tab === "Security" ? (
            <p className="text-sm text-slate-400">
              Security controls appear after the domain provider is connected. SSL status is{" "}
              {SSL_STATUS_LABELS[selectedSsl?.status ?? selected.sslStatus] ?? selected.sslStatus}.
            </p>
          ) : null}
        </SideDrawer>
      ) : null}
    </div>
  );
}