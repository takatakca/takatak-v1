import Link from "next/link";

import { deleteAudienceAction, toggleSiteAction } from "@/app/dashboard/growth/analytics/actions";
import { CopySnippet } from "@/components/growth/copy-snippet";
import { GrowthKpi } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics/service";

import { CreateAudienceForm, CreateSiteForm } from "./analytics-forms";
import { DailyChart, TopList } from "./daily-chart";

export function AnalyticsPanel({ data, canManage, origin }: { data: AnalyticsSummary; canManage: boolean; origin: string }) {
  const qs = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    const site = "site" in patch ? patch.site : data.selectedSiteId;
    const days = "days" in patch ? patch.days : data.days;
    if (site) params.set("site", String(site));
    if (days && days !== 30) params.set("days", String(days));
    const s = params.toString();
    return s ? `?${s}` : "?";
  };
  // Share of visits that converted at least once — never above 100%.
  const convRate = data.totals.visitors ? ((data.totals.convertingVisitors / data.totals.visitors) * 100).toFixed(1) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-slate-500">Website:</span>
        <Link href={qs({ site: null })} className={`rounded-full px-3 py-1 ${!data.selectedSiteId ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
          All
        </Link>
        {data.sites.map((s) => (
          <Link key={s.id} href={qs({ site: s.id })} className={`rounded-full px-3 py-1 ${data.selectedSiteId === s.id ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {s.name}
          </Link>
        ))}
        <span className="ml-auto font-medium text-slate-500">Period:</span>
        {[7, 30, 90].map((d) => (
          <Link key={d} href={qs({ days: d })} className={`rounded-full px-3 py-1 ${data.days === d ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {d} days
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GrowthKpi label="Page views" value={data.totals.pageviews.toLocaleString("en-CA")} />
        <GrowthKpi label="Visits (daily unique)" value={data.totals.visitors.toLocaleString("en-CA")} hint="Cookie-free; resets daily" />
        <GrowthKpi label="Conversions" value={data.totals.conversions.toLocaleString("en-CA")} hint="Calls, forms, WhatsApp, custom" />
        <GrowthKpi label="Conversion rate" value={convRate !== null ? `${convRate}%` : "—"} hint="Visits with ≥1 conversion" />
      </section>

      <Card>
        <CardHeader title="Page views" subtitle={`Last ${data.days} days`} />
        <CardBody>
          <DailyChart data={data.daily.map((d) => ({ day: d.day, value: d.pageviews }))} label="Page views" />
        </CardBody>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <TopList title="Top pages" rows={data.topPages} empty="No page views yet." />
        <TopList title="Traffic sources" rows={data.topReferrers} empty="No referrers yet (direct traffic only)." />
        <TopList title="Conversions" rows={data.conversions} empty="No conversions yet." />
        <TopList title="Campaigns (utm_campaign)" rows={data.campaigns} empty="Tag ad links with utm_campaign to see them here." />
        <TopList title="Devices" rows={data.devices} empty="—" />
        <TopList title="Countries" rows={data.countries} empty="Country needs a CDN geo header (e.g. Cloudflare)." />
      </section>

      <Card>
        <CardHeader title="Retargeting audiences" subtitle="Rules built from your own visitors. Reach counts matching visits (daily unique) in the lookback window." />
        <CardBody className="space-y-3">
          {data.audiences.length === 0 ? <p className="text-sm text-slate-500">No audiences yet.</p> : null}
          {data.audiences.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-xs">
              <p className="text-sm font-semibold text-slate-900">{a.name}</p>
              <span className="text-slate-500">{a.siteName}</span>
              <span className="text-slate-500">
                {[a.pathPrefixes.length ? `pages ${a.pathPrefixes.join(", ")}` : null, a.eventNames.length ? `events ${a.eventNames.join(", ")}` : null]
                  .filter(Boolean)
                  .join(" or ")}{" "}
                · {a.lookbackDays} days
              </span>
              <Badge tone="accent">{a.reach.toLocaleString("en-CA")} reach</Badge>
              {canManage ? (
                <form action={deleteAudienceAction} className="ml-auto">
                  <input type="hidden" name="audienceId" value={a.id} />
                  <button className="text-slate-400 hover:text-rose-600">Delete</button>
                </form>
              ) : null}
            </div>
          ))}
          {canManage && data.sites.length > 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <CreateAudienceForm sites={data.sites.map((s) => ({ id: s.id, name: s.name }))} />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tracked websites" subtitle="Cookie-free, no consent banner needed for analytics alone. Data is only accepted from each site's own domain." />
        <CardBody className="space-y-4">
          {data.sites.map((s) => (
            <div key={s.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                <span className="text-xs text-slate-500">{s.domain}</span>
                {s.brandName ? <span className="text-xs text-slate-400">· {s.brandName}</span> : null}
                <Badge tone={s.active ? "success" : "muted"}>{s.active ? "Collecting" : "Paused"}</Badge>
                {canManage ? (
                  <form action={toggleSiteAction} className="ml-auto">
                    <input type="hidden" name="siteId" value={s.id} />
                    <input type="hidden" name="active" value={s.active ? "false" : "true"} />
                    <button className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">{s.active ? "Pause" : "Resume"}</button>
                  </form>
                ) : null}
              </div>
              <CopySnippet code={`<script defer src="${origin}/takatak-analytics.js" data-site="${s.publicKey}"></script>`} />
            </div>
          ))}
          {canManage ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Add a website</p>
              <CreateSiteForm brands={data.brands} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
