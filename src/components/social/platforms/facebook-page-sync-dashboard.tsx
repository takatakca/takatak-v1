"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { requestSocialBrandSelectorRefresh } from "@/components/social/navigation/social-brand-selector-events";
import { FacebookSubscribedDashboard } from "@/components/social/platforms/facebook-subscribed-dashboard";
import { withSocialPreview } from "@/components/social/preview/social-preview-query";
import { dateKey } from "@/components/social/analytics/social-summary-tokens";

type SyncStatus =
  | "idle"
  | "syncing"
  | "ready"
  | "empty"
  | "degraded"
  | "action_required"
  | "failed";

type SyncPayload = {
  status: SyncStatus;
  pageName: string | null;
  profileImageUrl: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  timezone: string;
  partialData: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCategory: string | null;
  lastErrorMessage: string | null;
  retryCount: number;
  metricsAvailable: boolean;
  dataProvenance?: string;
  dataCompleteness?: string;
  lastSyncMode?: string | null;
  backfillStatus?: string | null;
  lastConfirmedDate?: string | null;
  rangeDisplayStatus?: string | null;
  rangeCoverageNotice?: string | null;
  coverageEnd?: string | null;
  operation?: {
    jobStatus: string | null;
    attempts: number | null;
    maxAttempts: number | null;
    nextRetryAt: string | null;
    leaseActive: boolean;
    leaseExpired: boolean;
    errorCategory: string | null;
  } | null;
};

type MetricRow = {
  date: string;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  followers: number | null;
  pageVisits?: number | null;
  followersAcquired?: number | null;
  followersLost?: number | null;
  contentPublished?: number | null;
  provenance?: {
    reach: string;
    impressions: string;
    engagement: string;
    followers: string;
    pageVisits?: string;
    followersAcquired?: string;
    followersLost?: string;
    contentPublished?: string;
  };
};

const brandSyncGetInFlight = new Map<
  string,
  Promise<SyncPayload | null>
>;

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(
  status: SyncStatus,
  rangeDisplayStatus?: string | null,
): string {
  if (rangeDisplayStatus === "partial") {
    return "Partial data";
  }
  if (rangeDisplayStatus === "empty") {
    return "No data";
  }
  switch (status) {
    case "syncing":
    case "idle":
      return "Syncing";
    case "ready":
      return "Ready";
    case "empty":
      return "No data";
    case "degraded":
      return "Partial data";
    case "action_required":
      return "Action required";
    case "failed":
      return "Sync failed";
    default:
      return "Unknown";
  }
}

function isActiveSyncJob(
  operation: SyncPayload["operation"] | undefined,
): boolean {
  if (!operation?.jobStatus) return false;
  return (
    operation.jobStatus === "running" ||
    operation.jobStatus === "queued" ||
    operation.jobStatus === "retrying" ||
    operation.leaseActive === true
  );
}

function needsReconnect(sync: SyncPayload | null): boolean {
  if (sync?.status !== "action_required") {
    return false;
  }
  const category =
    sync.lastErrorCategory ?? sync.operation?.errorCategory ?? null;
  return (
    category === "authorization_expired" ||
    category === "permission_required"
  );
}

function buildRangeQuery(days: number): {
  range: string;
  start?: string;
  end?: string;
} {
  if (days === 7) return { range: "last_7" };
  if (days === 30) return { range: "last_30" };
  if (days === 90) return { range: "last_90" };

  const endDate = new Date();
  endDate.setUTCHours(12, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - days + 1);
  return {
    range: "custom",
    start: dateKey(startDate),
    end: dateKey(endDate),
  };
}

export function FacebookPageSyncDashboard({
  pageName,
  profileImageUrl: _profileImageUrl,
  initialSyncStatus = null,
}: {
  pageName: string | null;
  profileImageUrl: string | null;
  initialSyncStatus?: SyncStatus | null;
}) {
  const searchParams = useSearchParams();
  const [sync, setSync] = useState<SyncPayload | null>(
    initialSyncStatus
      ? {
          status: initialSyncStatus,
          pageName,
          profileImageUrl: _profileImageUrl,
          rangeStart: null,
          rangeEnd: null,
          timezone: "UTC",
          partialData: false,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastErrorCategory: null,
          lastErrorMessage: null,
          retryCount: 0,
          metricsAvailable: false,
          dataProvenance: "pending",
        }
      : null,
  );
  const [, setMetrics] = useState<MetricRow[]>([]);
  const [, setCompareMetrics] = useState<MetricRow[]>([]);
  const [lifetimeFollowersSnapshot, setLifetimeFollowersSnapshot] = useState<{
    value: number;
    date: string;
    metaField: string;
    provenance: string;
    dateAttribution?: string;
    storedDate?: string | null;
  } | null>(null);
  const [viewsSeriesPoints, setViewsSeriesPoints] = useState<
    Array<{ date: string; value: number | null; coverage: string }>
  >([]);
  const [metricCoverage, setMetricCoverage] = useState<Record<
    string,
    {
      value: number | null;
      coveredThrough: string | null;
      coveredFrom?: string | null;
      isPartial: boolean;
      provenance: string;
      status: string;
      notice: string | null;
      kind?: string;
      chartAvailable?: boolean;
    }
  > | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [activeRange, setActiveRange] = useState<{
    start: string;
    end: string;
    compareStart: string | null;
    compareEnd: string | null;
  } | null>(null);
  const [busyAction, setBusyAction] = useState<"sync" | "reconnect" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const startedIdleRef = useRef(false);
  const refreshedSelectorRef = useRef(false);

  const busy = busyAction !== null;
  const rangeQuery = useMemo(() => buildRangeQuery(rangeDays), [rangeDays]);

  async function loadStatus(): Promise<SyncPayload | null> {
    const coalesceKey = `brand-facebook-sync:${rangeQuery.range}:${rangeQuery.start ?? ""}:${rangeQuery.end ?? ""}:${compareEnabled ? "1" : "0"}`;
    const existing = brandSyncGetInFlight.get(coalesceKey);
    if (existing) {
      return existing;
    }

    const promise = (async (): Promise<SyncPayload | null> => {
      try {
        const params = new URLSearchParams({
          range: rangeQuery.range,
          ...(compareEnabled ? { compare: "1" } : {}),
          ...(rangeQuery.start ? { start: rangeQuery.start } : {}),
          ...(rangeQuery.end ? { end: rangeQuery.end } : {}),
        });
        const response = await fetch(
          `/api/social/facebook/sync?${params.toString()}`,
          {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            cache: "no-store",
          },
        );

        const body = await readJson<{
          ok?: boolean;
          message?: string;
          sync?: SyncPayload;
          metrics?: MetricRow[];
          compareMetrics?: MetricRow[];
          range?: {
            start: string;
            end: string;
            compareStart: string | null;
            compareEnd: string | null;
          };
          lifetimeFollowers?: {
            value: number;
            date: string;
            metaField: string;
            provenance: string;
            dateAttribution?: string;
            storedDate?: string | null;
          } | null;
          viewsSeries?: Array<{
            date: string;
            value: number | null;
            coverage: string;
          }>;
          metricCoverage?: Record<
            string,
            {
              value: number | null;
              coveredThrough: string | null;
              coveredFrom?: string | null;
              isPartial: boolean;
              provenance: string;
              status: string;
              notice: string | null;
              kind?: string;
              chartAvailable?: boolean;
            }
          >;
          viewsTotal?: number | null;
          viewsProvenance?: {
            kind: string;
            coveredFrom: string | null;
            coveredThrough: string | null;
            chartAvailable: boolean;
            rejectedLegacyPeriodTotal: {
              value: number;
              coveredFrom: string;
              coveredThrough: string;
              dayCount: number;
              kind: string;
              reason: string;
            } | null;
          };
          uniqueMediaViewsTotal?: number | null;
        }>(response);

        if (!response.ok || !body.ok || !body.sync) {
          setError(body.message ?? "Sync status could not be loaded.");
          return body.sync ?? null;
        }

        setError(null);
        setSync(body.sync);
        setMetrics(Array.isArray(body.metrics) ? body.metrics : []);
        setCompareMetrics(
          Array.isArray(body.compareMetrics) ? body.compareMetrics : [],
        );
        setActiveRange(body.range ?? null);
        setLifetimeFollowersSnapshot(body.lifetimeFollowers ?? null);
        setViewsSeriesPoints(Array.isArray(body.viewsSeries) ? body.viewsSeries : []);
        setMetricCoverage(body.metricCoverage ?? null);
        return body.sync;
      } finally {
        brandSyncGetInFlight.delete(coalesceKey);
      }
    })();

    brandSyncGetInFlight.set(coalesceKey, promise);
    return promise;
  }

  async function runSync(resume = false) {
    if (busyAction !== null) return;

    setBusyAction("sync");
    setError(null);

    try {
      const response = await fetch("/api/social/facebook/sync", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resume }),
      });

      const body = await readJson<{
        ok?: boolean;
        message?: string;
        category?: string;
        sync?: SyncPayload;
      }>(response);

      if (!response.ok || !body.ok || !body.sync) {
        setError(body.message ?? "Facebook Page sync could not be started.");
        if (body.sync) {
          setSync(body.sync);
        }
        return;
      }

      setSync(body.sync);
    } catch {
      setError("Facebook Page sync could not be started.");
    } finally {
      setBusyAction(null);
    }
  }

  async function reconnectFacebook() {
    if (busyAction !== null) return;
    setBusyAction("reconnect");
    setError(null);

    try {
      const response = await fetch("/api/social/facebook/reconnect", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnPath: withSocialPreview(
            "/dashboard/social/facebook",
            searchParams,
          ),
        }),
      });

      const body = await readJson<{
        ok?: boolean;
        message?: string;
        authorization?: { authorizationUrl?: string };
      }>(response);

      const authorizationUrl = body.authorization?.authorizationUrl;
      if (!response.ok || !body.ok || !authorizationUrl) {
        setError(body.message ?? "Facebook could not be reconnected.");
        setBusyAction(null);
        return;
      }

      window.location.assign(authorizationUrl);
    } catch {
      setError("Facebook could not be reconnected.");
      setBusyAction(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const stillInFlight = (payload: SyncPayload | null) => {
      if (!payload) return false;
      if (payload.status === "idle" || payload.status === "syncing") {
        return true;
      }
      return isActiveSyncJob(payload.operation);
    };

    void (async () => {
      const first = await loadStatus();
      if (cancelled) return;

      const status = first?.status ?? null;

      // Never auto-enqueue when authorization must be renewed first.
      if (
        status === "action_required" ||
        initialSyncStatus === "action_required"
      ) {
        return;
      }

      if (
        (status === "idle" || initialSyncStatus === "idle") &&
        !startedIdleRef.current
      ) {
        startedIdleRef.current = true;
        void runSync(false);
      }

      if (
        stillInFlight(first) ||
        initialSyncStatus === "idle" ||
        initialSyncStatus === "syncing"
      ) {
        timer = setInterval(() => {
          void (async () => {
            const next = await loadStatus();
            if (cancelled) return;

            if (!stillInFlight(next)) {
              if (
                next &&
                !refreshedSelectorRef.current &&
                (next.status === "ready" ||
                  next.status === "degraded" ||
                  next.status === "empty")
              ) {
                refreshedSelectorRef.current = true;
                requestSocialBrandSelectorRefresh();
              }
              stopTimer();
            }
          })();
        }, 2500);
      }
    })();

    return () => {
      cancelled = true;
      stopTimer();
    };
    // brand-scoped mount + range changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, compareEnabled]);

  const status = sync?.status ?? (error ? "failed" : "syncing");
  const displayName = sync?.pageName ?? pageName ?? "Facebook Page";
  const lastSuccessLabel = formatUpdatedAt(sync?.lastSuccessAt ?? null);
  const lastAttemptLabel = formatUpdatedAt(sync?.lastAttemptAt ?? null);
  const reconnect = needsReconnect(sync);

  const metricsConfirmed =
    (status === "ready" || status === "degraded") &&
    sync?.metricsAvailable === true;

  const jobActive = isActiveSyncJob(sync?.operation);
  const refreshingWithData = metricsConfirmed && jobActive;

  const impressions =
    metricsConfirmed && metricCoverage?.views
      ? metricCoverage.views.value
      : null;
  // Lifetime total comes from at-or-before-range-end snapshot — never sum/max of daily rows alone.
  const lifetimeFollowers = metricsConfirmed
    ? (metricCoverage?.lifetime_followers?.value ??
      lifetimeFollowersSnapshot?.value ??
      null)
    : null;
  const coverageEnd =
    sync?.coverageEnd ??
    sync?.lastConfirmedDate ??
    activeRange?.end ??
    null;
  const netFollowerChange = metricsConfirmed
    ? (metricCoverage?.growth_net_followers?.value ?? null)
    : null;

  const viewsCoveredThrough =
    metricCoverage?.views?.coveredThrough ?? coverageEnd;
  const viewsCoveredFrom = metricCoverage?.views?.coveredFrom ?? null;
  const viewsIsPartial = metricCoverage?.views?.isPartial === true;
  // Only plot Views when provenance explicitly allows a daily series.
  const viewsChartAvailable = metricCoverage?.views?.chartAvailable === true;

  const viewsSeries = useMemo(() => {
    if (
      !metricsConfirmed ||
      !viewsChartAvailable ||
      viewsSeriesPoints.length === 0
    ) {
      return undefined;
    }
    return viewsSeriesPoints.map((point) => ({
      date: point.date,
      value: point.value,
      coverage:
        point.coverage === "confirmed"
          ? ("confirmed" as const)
          : ("uncovered" as const),
    }));
  }, [metricsConfirmed, viewsChartAvailable, viewsSeriesPoints]);

  const lifetimeAsOf =
    metricCoverage?.lifetime_followers?.coveredThrough ??
    lifetimeFollowersSnapshot?.date ??
    null;

  const rangeDisplayStatus = sync?.rangeDisplayStatus ?? null;
  const badgeStatus = refreshingWithData
    ? "syncing"
    : rangeDisplayStatus === "partial" || status === "degraded"
      ? "degraded"
      : rangeDisplayStatus === "empty"
        ? "empty"
        : status;
  const badgeLabel = refreshingWithData
    ? "Refreshing"
    : statusLabel(status, rangeDisplayStatus);

  const showAnalyticsShell =
    status !== "syncing" && status !== "idle";

  return (
    <div className="space-y-4">
      <section className="rounded-[14px] border border-[#e8eaed] bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6b7280]">
                Facebook Page
              </p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  badgeStatus === "ready"
                    ? "bg-emerald-100 text-emerald-900"
                    : badgeStatus === "syncing" || badgeStatus === "idle"
                      ? "bg-sky-100 text-sky-900"
                      : badgeStatus === "empty" || badgeStatus === "degraded"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-rose-100 text-rose-900"
                }`}
              >
                {badgeLabel}
              </span>
            </div>
            <h1
              className="mt-1 truncate text-[22px] font-semibold text-[#20242A]"
              title={displayName}
            >
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-[#5F6770]">
              {activeRange
                ? `Selected ${activeRange.start} → ${activeRange.end}`
                : sync?.rangeStart && sync?.rangeEnd
                  ? `Synced ${sync.rangeStart} → ${sync.rangeEnd}`
                  : "Waiting for synchronized data range"}
              {sync?.coverageEnd
                ? ` · Data through ${sync.coverageEnd}`
                : sync?.lastConfirmedDate
                  ? ` · Confirmed through ${sync.lastConfirmedDate}`
                  : null}
              {sync?.timezone ? ` · ${sync.timezone}` : null}
              {lastSuccessLabel
                ? ` · Last successful sync ${lastSuccessLabel}`
                : lastAttemptLabel
                  ? ` · Last attempt ${lastAttemptLabel}`
                  : null}
              {sync?.partialData ? " · Partial / may be stale" : null}
              {sync?.dataProvenance
                ? ` · Provenance ${sync.dataProvenance}`
                : null}
            </p>
            {sync?.rangeCoverageNotice ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {sync.rangeCoverageNotice}
              </p>
            ) : null}
            {refreshingWithData ? (
              <p className="mt-1 text-xs text-[#6b7280]">
                Refreshing — showing data from the last successful sync
                {typeof sync?.operation?.attempts === "number" &&
                typeof sync?.operation?.maxAttempts === "number"
                  ? ` · attempt ${sync.operation.attempts}/${sync.operation.maxAttempts}`
                  : null}
              </p>
            ) : jobActive && sync?.operation ? (
              <p className="mt-1 text-xs text-[#6b7280]">
                Job {sync.operation.jobStatus ?? "unknown"}
                {typeof sync.operation.attempts === "number" &&
                typeof sync.operation.maxAttempts === "number"
                  ? ` · attempt ${sync.operation.attempts}/${sync.operation.maxAttempts}`
                  : null}
                {sync.operation.nextRetryAt
                  ? ` · next ${formatUpdatedAt(sync.operation.nextRetryAt)}`
                  : null}
                {sync.operation.leaseActive ? " · lease active" : null}
                {sync.operation.leaseExpired ? " · lease expired" : null}
                {sync.operation.errorCategory
                  ? ` · ${sync.operation.errorCategory}`
                  : null}
              </p>
            ) : null}
          </div>

          {reconnect ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  refreshedSelectorRef.current = false;
                  void (async () => {
                    await runSync(false);
                    const poll = setInterval(() => {
                      void (async () => {
                        const next = await loadStatus();
                        if (
                          next &&
                          next.status !== "syncing" &&
                          next.status !== "idle" &&
                          !isActiveSyncJob(next.operation)
                        ) {
                          if (!refreshedSelectorRef.current) {
                            refreshedSelectorRef.current = true;
                            requestSocialBrandSelectorRefresh();
                          }
                          clearInterval(poll);
                        }
                      })();
                    }, 2500);
                    window.setTimeout(() => clearInterval(poll), 120_000);
                  })();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {busyAction === "sync" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry sync
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void reconnectFacebook();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900 transition hover:bg-rose-100 disabled:opacity-50"
              >
                {busyAction === "reconnect" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Reconnect Facebook
              </button>
            </div>
          ) : null}

          {!reconnect &&
            (status === "failed" ||
              status === "action_required" ||
              status === "degraded" ||
              status === "empty") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  refreshedSelectorRef.current = false;
                  void (async () => {
                    await runSync(status === "degraded");
                    const poll = setInterval(() => {
                      void (async () => {
                        const next = await loadStatus();
                        if (
                          next &&
                          next.status !== "syncing" &&
                          next.status !== "idle" &&
                          !isActiveSyncJob(next.operation)
                        ) {
                          if (!refreshedSelectorRef.current) {
                            refreshedSelectorRef.current = true;
                            requestSocialBrandSelectorRefresh();
                          }
                          clearInterval(poll);
                        }
                      })();
                    }, 2500);
                    window.setTimeout(() => clearInterval(poll), 120_000);
                  })();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {busyAction === "sync" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {status === "degraded" ? "Resume sync" : "Retry sync"}
              </button>
            )}
        </div>

        {status === "syncing" || status === "idle" ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f4f5f7] px-4 py-3 text-sm text-[#505761]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Synchronizing Page identity and engagement metrics…
          </div>
        ) : null}

        {status === "empty" ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Sync succeeded. No data available for this period. TAKATAK does not
            invent zero metrics before Facebook returns data.
          </div>
        ) : null}

        {status === "degraded" ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Partial analytics synchronized. Some pages of Meta insights were
            unavailable — resume to continue safely.
          </div>
        ) : null}

        {status === "action_required" ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {sync?.lastErrorMessage ??
              "Facebook authorization or Page access needs attention."}
          </div>
        ) : null}

        {status === "failed" ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {sync?.lastErrorMessage ??
              "Facebook Page sync failed. You can retry."}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {status === "syncing" || status === "idle" ? (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <div className="h-28 animate-pulse rounded-[14px] bg-[#e8eaed]" />
          <div className="h-64 animate-pulse rounded-[14px] bg-[#e8eaed]" />
          <div className="h-48 animate-pulse rounded-[14px] bg-[#e8eaed]" />
        </div>
      ) : null}

      {showAnalyticsShell ? (
        <FacebookSubscribedDashboard
          mode="live"
          live={
            metricsConfirmed
              ? {
                  lifetimeFollowers,
                  lifetimeFollowersAsOf: lifetimeAsOf,
                  lifetimeFollowersProvenance:
                    metricCoverage?.lifetime_followers?.provenance ??
                    lifetimeFollowersSnapshot?.provenance ??
                    null,
                  netFollowerChange,
                  followersAcquired:
                    metricCoverage?.followers_acquired?.value ?? null,
                  followersLost:
                    metricCoverage?.followers_lost?.value ?? null,
                  mediaViews: impressions,
                  mediaViewsCoveredThrough: viewsCoveredThrough,
                  mediaViewsCoveredFrom: viewsCoveredFrom,
                  mediaViewsIsPartial: viewsIsPartial,
                  uniqueMediaViews:
                    metricCoverage?.unique_media_views?.value ?? null,
                  viewsSeries,
                  metricCoverage,
                  coverageNotice:
                    metricCoverage?.views?.notice ??
                    sync?.rangeCoverageNotice ??
                    null,
                  coveragePartial:
                    rangeDisplayStatus === "partial" || viewsIsPartial,
                }
              : {
                  lifetimeFollowers: null,
                  lifetimeFollowersAsOf: null,
                  lifetimeFollowersProvenance: null,
                  netFollowerChange: null,
                  followersAcquired: null,
                  followersLost: null,
                  mediaViews: null,
                  mediaViewsCoveredThrough: null,
                  mediaViewsIsPartial: false,
                  uniqueMediaViews: null,
                  metricCoverage,
                  coverageNotice: sync?.rangeCoverageNotice ?? null,
                  coveragePartial: rangeDisplayStatus === "partial",
                }
          }
          rangeDays={rangeDays}
          onRangeDaysChange={setRangeDays}
          compareEnabled={compareEnabled}
          onCompareEnabledChange={setCompareEnabled}
          rangeLabel={
            activeRange
              ? { start: activeRange.start, end: activeRange.end }
              : null
          }
        />
      ) : null}
    </div>
  );
}
