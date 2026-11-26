"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock3,
  Eye,
  MoreHorizontal,
  Settings,
  TrendingDown,
  Users,
} from "lucide-react";
import { DonutChart, Sparkline } from "@/components/dashboard/home/charts";
import { formatCompactNumber } from "@/components/dashboard/home/format";
import {
  Field,
  PagePager,
  SideDrawer,
  SiteMark,
  StatusDot,
  TextInput,
  WorkspaceToolbar,
} from "@/components/web-hosting/web-workspace-ui";
import {
  displayWebsiteStatus,
  hostingForDomain,
  websiteUrl,
} from "@/lib/web-hosting/display";
import type { DomainSummary, HostingServiceSummary } from "@/lib/web-hosting/types";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";

const WEBSITE_TABS = ["Overview", "Edit Details", "SEO Settings", "Integrations", "Security"];
const RANGES = ["7D", "30D", "3M", "6M", "1Y"] as const;

export function WebsitesManager({
  domains,
  hosting,
  sourceLabel,
}: {
  domains: DomainSummary[];
  hosting: HostingServiceSummary[];
  sourceLabel: string;
}) {
  const fr = useDashboardLanguage() === "fr";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState(WEBSITE_TABS[1]);
  const [range, setRange] = useState<(typeof RANGES)[number]>("30D");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return domains.filter((domain) => {
      const hostingRow = hostingForDomain(domain, hosting);
      const status = displayWebsiteStatus(domain, hostingRow);
      const matchesQuery =
        !query ||
        domain.domainName.toLowerCase().includes(query) ||
        (domain.brandName ?? "").toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || status.label.toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [domains, hosting, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selected = domains.find((domain) => domain.id === selectedId) ?? null;
  const selectedHosting = selected ? hostingForDomain(selected, hosting) : undefined;
  const selectedStatus = selected ? displayWebsiteStatus(selected, selectedHosting) : null;

  const performance = [
    { label: "Total Sessions", icon: Users, color: "#3b82f6" },
    { label: "Page Views", icon: Eye, color: "#8b5cf6" },
    { label: "Avg. Session Duration", icon: Clock3, color: "#22c55e" },
    { label: "Bounce Rate", icon: TrendingDown, color: "#f97316" },
  ];

  return (
    <div className={selected ? "lg:pr-[420px]" : undefined}>
      <div className="space-y-5">
        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-5 py-4">
            <WorkspaceToolbar
              search={search}
              onSearch={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search websites..."
              status={statusFilter}
              onStatus={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              statusOptions={[
                { value: "all", label: "All Status" },
                { value: "active", label: "Active" },
                { value: "pending setup", label: "Pending setup" },
                { value: "planned", label: "Planned" },
                { value: "not connected", label: "Not connected" },
              ]}
              addLabel="Add Website"
              addHref="/dashboard/support?demande=website"
              exportName="takatak-sites-web"
              exportRows={filtered.map((domain) => ({
                Site: domain.domainName,
                Marque: domain.brandName ?? "",
                Statut: displayWebsiteStatus(domain, hostingForDomain(domain, hosting)).label,
                DNS: domain.dnsStatus,
                SSL: domain.sslStatus,
              }))}
            />
          </div>
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="px-5 pb-2 font-medium">{fr ? "Site Web" : "Website"}</th>
                    <th className="px-3 pb-2 font-medium">{fr ? "Statut" : "Status"}</th>
                    <th className="px-3 pb-2 font-medium">{fr ? "Trafic (30 j)" : "Traffic (30D)"}</th>
                    <th className="px-3 pb-2 font-medium">{fr ? "Disponibilité" : "Uptime"}</th>
                    <th className="px-3 pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((domain) => {
                    const hostingRow = hostingForDomain(domain, hosting);
                    const status = displayWebsiteStatus(domain, hostingRow);
                    const active = domain.id === selectedId;
                    return (
                      <tr
                        key={domain.id}
                        onClick={() => {
                          setSelectedId(domain.id);
                          setTab("Edit Details");
                        }}
                        className={`cursor-pointer border-t border-slate-100 ${
                          active ? "border-l-2 border-l-blue-500 bg-blue-50/50" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <SiteMark domain={domain.domainName} imageUrl={domain.brandImageUrl} />
                            <div>
                              <p className="font-medium text-slate-800">{domain.brandName ?? domain.domainName}</p>
                              <p className="text-xs text-slate-400">{domain.domainName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <StatusDot tone={status.tone} label={status.label} />
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-400">
                          —<p className="text-[11px]">{fr ? "Statistiques non branchées" : "Analytics not connected"}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-400">
                          —<p className="text-[11px]">{fr ? "Disponibilité non branchée" : "Uptime not connected"}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-slate-400">
                            <a
                              href={websiteUrl(domain)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="-m-1 rounded-md p-2 hover:bg-white hover:text-slate-700"
                              aria-label="View website"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(domain.id);
                                setTab("Edit Details");
                              }}
                              className="-m-1 rounded-md p-2 hover:bg-white hover:text-slate-700"
                              aria-label="Réglages · Settings"
                            >
                              <Settings className="h-4 w-4" />
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
            <p className="px-5 pb-5 text-sm text-slate-400">{fr ? "Aucun site ne correspond à ces filtres." : "No websites match these filters."}</p>
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
            noun="websites"
          />
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{fr ? "Performance du site" : "Website Performance"}</h3>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
              {RANGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setRange(item)}
                  className={`rounded-md px-3 py-1.5 ${
                    range === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {performance.map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-slate-500">{metric.label}</p>
                    <Icon className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">—</p>
                  <Sparkline values={[]} color={metric.color} />
                  <p className="text-[11px] text-slate-400">{fr ? "Les statistiques du site ne sont pas branchées" : "Website analytics is not connected"}</p>
                </article>
              );
            })}
          </div>
        </article>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">{fr ? "Sources de trafic" : "Traffic Sources"}</h3>
            <div className="mt-4 flex items-center gap-4">
              <DonutChart slices={[]} totalLabel={formatCompactNumber(null)} />
              <p className="text-sm text-slate-400">{fr ? "Les sources de trafic apparaissent une fois les statistiques branchées." : "Traffic sources appear when analytics is connected."}</p>
            </div>
          </article>
          <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-semibold text-slate-900">{fr ? "Pages principales" : "Top Pages"}</h3>
            <p className="mt-4 text-sm text-slate-400">{fr ? "Les pages principales apparaissent une fois les statistiques branchées." : "Top pages appear when analytics is connected."}</p>
          </article>
        </section>

        <p className="text-[11px] text-slate-400">{sourceLabel}</p>
      </div>

      {selected && selectedStatus ? (
        <SideDrawer
          title={selected.brandName ?? selected.domainName}
          subtitle={websiteUrl(selected)}
          badge={
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${selectedStatus.className}`}>
              {selectedStatus.label}
            </span>
          }
          onClose={() => setSelectedId(null)}
          tabs={WEBSITE_TABS}
          activeTab={tab}
          onTab={setTab}
          requestHref="/dashboard/support?demande=website-settings"
        >
          {tab === "Overview" ? (
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">{fr ? "Hébergement" : "Hosting"}</span>
                <br />
                {selectedHosting?.planName ?? "None"}
              </p>
              <p>
                <span className="text-slate-400">{fr ? "Catégorie" : "Category"}</span>
                <br />
                {selected.brandCategory ?? "—"}
              </p>
            </div>
          ) : null}

          {tab === "Edit Details" ? (
            <div className="space-y-4">
              <Field label="Website Name">
                <TextInput value={selected.brandName ?? selected.domainName} />
              </Field>
              <Field label="Website URL">
                <TextInput value={websiteUrl(selected)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <TextInput value={selected.brandCategory ?? "—"} />
                </Field>
                <Field label="Industry">
                  <TextInput value="—" />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  readOnly
                  rows={3}
                  value=""
                  placeholder="Description is not stored on this record yet."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                />
                <p className="mt-1 text-right text-[11px] text-slate-400">0/160</p>
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium text-slate-600">{fr ? "Icône du site" : "Favicon"}</p>
                <div className="flex items-center gap-3">
                  <SiteMark domain={selected.domainName} imageUrl={selected.brandImageUrl} />
                  <Link
                    href="/dashboard/support?demande=site-favicon"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300"
                  >
                    Changer l’icône · Change favicon
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Default Language">
                  <TextInput value="—" />
                </Field>
                <Field label="Time Zone">
                  <TextInput value={selected.brandTimezone ?? "—"} />
                </Field>
              </div>
              <Field label="Google Analytics ID">
                <input
                  readOnly
                  placeholder="G-XXXXXXXXXX"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                />
              </Field>
              <Field label="Google Search Console">
                <input
                  readOnly
                  placeholder="Not connected"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                />
              </Field>
            </div>
          ) : null}

          {tab === "SEO Settings" ? (
            <p className="text-sm text-slate-400">{fr ? "Les réglages SEO apparaissent une fois le module du site branché." : "SEO settings appear when the website module is connected."}</p>
          ) : null}
          {tab === "Integrations" ? (
            <p className="text-sm text-slate-400">{fr ? "Les statistiques et la recherche ne sont pas branchées." : "Analytics and search integrations are not connected."}</p>
          ) : null}
          {tab === "Security" ? (
            <p className="text-sm text-slate-400">{fr ? "Les contrôles de sécurité apparaissent une fois l’hébergement mis en place." : "Security controls appear after hosting is provisioned."}</p>
          ) : null}
        </SideDrawer>
      ) : null}
    </div>
  );
}