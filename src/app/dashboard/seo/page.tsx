import { Globe2, Info } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { EmptyState } from "@/components/saas/empty-state";
import { RunAuditButton } from "@/components/seo/run-audit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MODULE_PLACEHOLDERS } from "@/lib/dashboard/dashboard-config";
import { getPrisma } from "@/lib/db/prisma";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspacePermission } from "@/lib/security/workspace-guard";
import { CHECK_LABELS } from "@/lib/seo/checks";
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

export default async function SeoPage() {
  const access = await requireWorkspacePermission("view_reports", "/dashboard/seo");
  const prisma = getPrisma();
  if (!prisma) return <ModulePlaceholder def={MODULE_PLACEHOLDERS.seo} />;

  const sites = await loadSeoOverview(prisma, access.activeClientId);
  const canRun = hasEffectivePermission(access, "manage_brands");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">SEO</h1>
        <Badge tone="accent">Technical audit</Badge>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        TAKATAK scans up to 10 pages of each website in this workspace and checks what search engines need: secure access, titles and descriptions, headings, mobile readiness, indexing rules, sitemap, images and speed.
      </p>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe2}
          title="No website linked to this workspace yet"
          description="Add a domain in Web Integration or a website on a brand, and it will appear here for auditing."
        />
      ) : (
        <div className="space-y-4">
          {sites.map((site) => (
            <SiteAudit key={site.host} site={site} canRun={canRun} />
          ))}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Keyword rankings and backlinks need Google Search Console or an SEO data provider, which are not connected yet. Audits only read public pages of this workspace&apos;s own websites.
      </p>
    </div>
  );
}
