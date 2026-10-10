import Link from "next/link";
import { Globe2 } from "lucide-react";

import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { PageSpeedForm } from "@/components/growth/pagespeed-form";
import { SiteAuditForm } from "@/components/growth/site-audit-form";
import { EmptyState } from "@/components/saas/empty-state";
import { RunAuditButton } from "@/components/seo/run-audit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatuses } from "@/lib/growth/status";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { CHECK_LABELS } from "@/lib/seo/checks";
import { pageSpeedConfigured } from "@/lib/seo/pagespeed";
import { loadSeoOverview, type SeoOverviewSite } from "@/lib/seo/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO",
  robots: { index: false, follow: false },
};

const SEVERITY_ORDER = ["critical", "warning", "notice"] as const;
const SEVERITY_LABEL = { critical: "Critical", warning: "Warnings", notice: "Suggestions" } as const;
const SEVERITY_TONE = { critical: "danger", warning: "warning", notice: "neutral" } as const;

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-700";
  if (score >= 60) return "text-amber-600";
  return "text-rose-700";
}

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(date);
}

function SiteAudit({ site, canRun }: { site: SeoOverviewSite; canRun: boolean }) {
  const latest = site.latest;
  const interrupted = latest?.status === "interrupted";

  const groups = SEVERITY_ORDER.map((severity) => {
    const byCheck = new Map<string, { detail: string | null; pages: string[] }>();
    for (const issue of latest?.issues ?? []) {
      if (issue.severity !== severity) continue;
      const entry = byCheck.get(issue.checkKey) ?? { detail: issue.detail, pages: [] };
      if (issue.pageUrl) entry.pages.push(issue.pageUrl);
      byCheck.set(issue.checkKey, entry);
    }
    return { severity, checks: [...byCheck.entries()] };
  });

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Globe2 className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{site.label}</p>
              <p className="text-xs text-slate-500">
                {latest?.finishedAt
                  ? `Last audit ${when(latest.finishedAt)} · ${latest.pagesScanned} pages scanned`
                  : latest && !interrupted
                    ? "Audit in progress…"
                    : "Not audited yet"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            {latest?.status === "completed" && latest.score !== null ? (
              <div className="text-right">
                <p className={`text-3xl font-semibold tabular-nums ${scoreTone(latest.score)}`}>{latest.score}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">SEO health / 100</p>
              </div>
            ) : null}
            {canRun ? <RunAuditButton host={site.host} /> : null}
          </div>
        </div>

        {latest?.status === "failed" || interrupted ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            The last audit could not finish. Check that the website is online, then run it again.
          </p>
        ) : null}

        {latest?.status === "completed" && latest.issues.length === 0 ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            No technical issues found on the scanned pages.
          </p>
        ) : null}

        {latest?.status === "completed"
          ? groups
              .filter((group) => group.checks.length)
              .map((group) => (
                <div key={group.severity} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={SEVERITY_TONE[group.severity]}>{SEVERITY_LABEL[group.severity]}</Badge>
                    <span className="text-xs text-slate-400">{group.checks.length} checks</span>
                  </div>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                    {group.checks.map(([checkKey, entry]) => (
                      <li key={checkKey} className="px-3 py-2">
                        <details>
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-slate-800">
                            <span>{CHECK_LABELS[checkKey] ?? checkKey}</span>
                            <span className="shrink-0 text-xs text-slate-400">
                              {entry.pages.length ? `${entry.pages.length} page${entry.pages.length === 1 ? "" : "s"}` : "Site-wide"}
                            </span>
                          </summary>
                          {entry.detail ? <p className="mt-1 text-xs text-slate-500">{entry.detail}</p> : null}
                          {entry.pages.length ? (
                            <ul className="mt-1 space-y-0.5">
                              {entry.pages.slice(0, 10).map((page) => (
                                <li key={page} className="truncate text-xs text-slate-500">{page}</li>
                              ))}
                            </ul>
                          ) : null}
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          : null}
      </CardBody>
    </Card>
  );
}

export default async function SeoOverviewPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/seo");
  const seoConnectors = getConnectorStatuses().filter((c) => c.category === "seo" || c.key === "search_console" || c.key === "brightlocal");

  // Saved multi-page audits of this workspace's own websites (#135).
  const prisma = getPrisma();
  const workspaceAudits =
    prisma && access.mode === "client_scoped" && hasEffectivePermission(access, "view_reports")
      ? { sites: await loadSeoOverview(prisma, access.activeClientId), canRun: hasEffectivePermission(access, "manage_brands") }
      : null;

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="SEO"
        description="Audit this workspace's websites and any client page, then layer in keyword, backlink and local-rank data as each SEO provider is connected."
        badges={[{ label: "Site audit live", tone: "success" }]}
      />

      {workspaceAudits ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Your websites: saved audits</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-600">
              Up to 10 pages per website, 22 checks: secure access, titles and descriptions, headings, mobile readiness, indexing rules,
              sitemap, images and speed. Results are kept so you can compare over time.
            </p>
          </div>
          {workspaceAudits.sites.length === 0 ? (
            <EmptyState
              icon={Globe2}
              title="No website linked to this workspace yet"
              description="Add a domain in Web Integration or a website on a brand, and it will appear here for auditing."
            />
          ) : (
            workspaceAudits.sites.map((site) => <SiteAudit key={site.host} site={site} canRun={workspaceAudits.canRun} />)
          )}
        </section>
      ) : null}

      <Card>
        <CardHeader
          title="Quick check of any page"
          subtitle="Checks one live page, robots.txt and sitemap right now. Nothing is stored; no third-party API is called."
        />
        <CardBody>
          <SiteAuditForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Speed & Core Web Vitals" subtitle="Google PageSpeed Insights: the same speed scores Google uses for ranking." />
        <CardBody>
          <PageSpeedForm configured={pageSpeedConfigured()} />
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/dashboard/seo/keywords" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
          <p className="text-sm font-semibold text-slate-900">Keywords →</p>
          <p className="mt-1 text-xs text-slate-600">Rank tracking, search volume and opportunities.</p>
        </Link>
        <Link href="/dashboard/seo/backlinks" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
          <p className="text-sm font-semibold text-slate-900">Backlinks →</p>
          <p className="mt-1 text-xs text-slate-600">Referring domains, new and lost links, toxic link watch.</p>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">SEO data providers</h2>
        <ConnectorGrid connectors={seoConnectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>
          Keyword volumes, rankings and backlink counts are never estimated. They appear only after a provider above has real credentials and a
          verified API call.
        </HonestyNote>
      </section>
    </div>
  );
}
