import Link from "next/link";
import { ArrowDown, ArrowUp, Star } from "lucide-react";
import type { DashboardHomeData } from "@/lib/dashboard/home-data";
import { GlobalAdminViewWarning } from "@/components/security/global-admin-view-warning";
import { DonutChart, Sparkline } from "./charts";
import {
  formatChangePct,
  formatChangePoints,
  formatCompactNumber,
  formatRelativeTime,
} from "./format";
import {
  IntegrationRowIcon,
  LinkedPlatformIcon,
  sortLinkedPlatforms,
} from "./platform-icons";
import { QuickActionsMenu } from "./quick-actions-menu";

function MovementBadge({
  tone,
  label,
}: {
  tone: "up" | "down" | "flat";
  label: string;
}) {
  if (tone === "flat") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
        {label}
      </span>
    );
  }

  const up = tone === "up";
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
        up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {label}
    </span>
  );
}

function StatusText({ status }: { status: string }) {
  if (status === "connected") {
    return <span className="text-sm font-medium text-emerald-600">Connected</span>;
  }
  if (status === "error") {
    return <span className="text-sm font-medium text-rose-600">Error</span>;
  }
  if (status === "expired") {
    return <span className="text-sm font-medium text-amber-600">Expired</span>;
  }
  return <span className="text-sm font-medium text-slate-400">Not connected</span>;
}

function KpiCard({
  title,
  value,
  previous,
  series,
  color,
  hint,
}: {
  title: string;
  value: number | null;
  previous: number | null;
  series: number[];
  color: string;
  hint?: string;
}) {
  const change = formatChangePct(value, previous);
  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <p className="text-sm text-slate-500">{title}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-2xl font-semibold tracking-tight text-slate-900">
          {formatCompactNumber(value)}
        </p>
        {change ? <MovementBadge tone={change.tone} label={change.label} /> : null}
      </div>
      <div className="mt-3">
        <Sparkline values={series} color={color} />
      </div>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </article>
  );
}

export function DashboardHomeView({
  data,
  isPlatformAdmin,
}: {
  data: DashboardHomeData;
  isPlatformAdmin: boolean;
}) {
  const performanceTotal = data.performance.reduce((sum, slice) => sum + slice.value, 0);
  const ratingChange = formatChangePoints(data.kpis.avgRating.value, data.kpis.avgRating.previous);

  return (
    <div className="space-y-6">
      {isPlatformAdmin ? <GlobalAdminViewWarning /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, {data.welcomeName} 👋
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your business across all integrated platforms.
          </p>
        </div>
        <QuickActionsMenu />
      </div>

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCard
          title={data.kpis.reach.label}
          value={data.kpis.reach.value}
          previous={data.kpis.reach.previous}
          series={data.kpis.reach.series}
          color="#3b82f6"
          hint={!data.kpis.reach.available ? data.kpis.reach.hint : undefined}
        />
        <KpiCard
          title={data.kpis.engagement.label}
          value={data.kpis.engagement.value}
          previous={data.kpis.engagement.previous}
          series={data.kpis.engagement.series}
          color="#22c55e"
          hint={!data.kpis.engagement.available ? data.kpis.engagement.hint : undefined}
        />
        <KpiCard
          title={data.kpis.websiteTraffic.label}
          value={data.kpis.websiteTraffic.value}
          previous={data.kpis.websiteTraffic.previous}
          series={data.kpis.websiteTraffic.series}
          color="#8b5cf6"
          hint={!data.kpis.websiteTraffic.available ? data.kpis.websiteTraffic.hint : undefined}
        />
        <KpiCard
          title={data.kpis.conversions.label}
          value={data.kpis.conversions.value}
          previous={data.kpis.conversions.previous}
          series={data.kpis.conversions.series}
          color="#f97316"
          hint={!data.kpis.conversions.available ? data.kpis.conversions.hint : undefined}
        />
        <article className="relative rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <Star className="absolute right-4 top-4 h-5 w-5 fill-amber-400 text-amber-400" />
          <p className="text-sm text-slate-500">{data.kpis.avgRating.label}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {data.kpis.avgRating.value != null
                ? data.kpis.avgRating.value.toFixed(1)
                : "—"}
            </p>
            {ratingChange ? (
              <MovementBadge tone={ratingChange.tone} label={ratingChange.label} />
            ) : null}
          </div>
          <p className="mt-6 text-[11px] text-slate-400">
            {data.kpis.avgRating.reviewCount
              ? `(${formatCompactNumber(data.kpis.avgRating.reviewCount)} reviews)`
              : data.kpis.avgRating.hint}
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2" aria-label="Overview">
        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Integration Overview</h3>
            <Link href="/dashboard/integrations" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              See all integrations
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.integrations.map((row) => {
              const linked = sortLinkedPlatforms(row.platforms);
              return (
                <Link
                  key={row.key}
                  href={row.href}
                  prefetch={false}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                >
                  <IntegrationRowIcon rowKey={row.key} />
                  <p className="w-28 shrink-0 text-sm font-medium text-slate-800">{row.label}</p>
                  <div className="min-w-0 flex-1">
                    {linked.length ? (
                      <span className="flex items-center gap-1.5">
                        {linked.slice(0, 6).map((platform) => (
                          <LinkedPlatformIcon key={platform} platform={platform} />
                        ))}
                      </span>
                    ) : (
                      <p className="truncate text-xs text-slate-400">{row.detail}</p>
                    )}
                  </div>
                  <StatusText status={row.status} />
                </Link>
              );
            })}
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <h3 className="text-sm font-semibold text-slate-900">Performance Overview</h3>
          <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart
              slices={data.performance}
              totalLabel={formatCompactNumber(performanceTotal || null)}
            />
            <ul className="w-full space-y-3">
              {data.performance.map((slice) => {
                const pct = performanceTotal ? Math.round((slice.value / performanceTotal) * 100) : 0;
                return (
                  <li key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                      {slice.label}
                    </span>
                    <span className="text-slate-900">
                      {formatCompactNumber(slice.value)}
                      <span className="ml-2 text-xs text-slate-400">{pct}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Details">
        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Top Pages by Traffic</h3>
          </div>
          {data.topPages.length ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400">
                <tr>
                  <th className="px-5 pb-2 font-medium">Page</th>
                  <th className="px-2 pb-2 font-medium">Sessions</th>
                  <th className="px-5 pb-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((page) => (
                  <tr key={page.path} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-800">{page.path}</td>
                    <td className="px-2 py-3 text-slate-600">{formatCompactNumber(page.sessions)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">
                      {page.changePct == null ? "—" : `${page.changePct > 0 ? "+" : ""}${page.changePct}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 pb-4 text-sm text-slate-400">
              Page traffic appears when website analytics is connected.
            </p>
          )}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link href="/dashboard/reports" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              View full report
            </Link>
          </div>
        </article>

        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Top Social Posts</h3>
          </div>
          {data.topPosts.length ? (
            <ul className="divide-y divide-slate-100">
              {data.topPosts.map((post) => (
                <li key={post.id} className="flex items-start gap-3 px-5 py-3">
                  <LinkedPlatformIcon platform={post.platform} />
                  <p className="min-w-0 flex-1 text-sm text-slate-700">{post.caption}</p>
                  <span className="shrink-0 text-sm font-medium text-slate-900">
                    {post.engagement == null ? "—" : formatCompactNumber(post.engagement)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-4 text-sm text-slate-400">
              Published posts appear here after a social account is connected.
            </p>
          )}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link href="/dashboard/social/posts" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              View all posts
            </Link>
          </div>
        </article>

        <article className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Recent Reviews</h3>
            <Link
              href="/dashboard/local-listings/reviews"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              See all reviews
            </Link>
          </div>
          {data.reviews.length ? (
            <ul className="divide-y divide-slate-100">
              {data.reviews.map((review) => (
                <li key={review.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {review.reviewerName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{review.reviewerName}</p>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {formatRelativeTime(review.reviewedAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={index}
                            className={`h-3 w-3 ${
                              review.rating && index < review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{review.body}</p>
                    </div>
                    <LinkedPlatformIcon platform={review.provider} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pb-4 text-sm text-slate-400">Reviews appear here once a source is connected.</p>
          )}
        </article>
      </section>

      <p className="text-[11px] text-slate-400">{data.sourceLabel}</p>
    </div>
  );
}
