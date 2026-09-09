import { NextRequest, NextResponse } from "next/server";

import { clipAnalyticsDateRangeForClient } from "@/lib/billing/social/entitlement-gates";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalFacebookDashboard } from "@/lib/social/connections/facebook-dashboard-resolve";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { getPrisma } from "@/lib/db/prisma";
import {
  enqueueInitialFacebookPageSync,
  getSelectedFacebookPageSyncSnapshot,
  listSelectedFacebookPageMetrics,
  resolveLifetimeFollowersSnapshot,
} from "@/lib/social/sync/facebook-page-initial-sync";
import {
  buildCoveredMetricSeries,
  buildFacebookMetricCoverageMap,
  resolveViewsDisplayFromStoredDays,
  sumConfirmedDailyValues,
} from "@/lib/social/sync/facebook-metric-write";
import {
  deriveNetFollowerChangeFromDailyFollows,
  resolveFacebookSelectedRangeCoverage,
} from "@/lib/social/sync/facebook-range-coverage";
import { releaseExpiredFacebookPageSyncLeases } from "@/lib/social/sync/facebook-page-sync-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const syncGetInFlight = new Map<string, Promise<NextResponse>>();

function syncClientPayload(
  sync: NonNullable<
    Awaited<ReturnType<typeof getSelectedFacebookPageSyncSnapshot>>
  >,
  coverage?: {
    dataCompleteness: string;
    rangeDisplayStatus: string;
    notice: string | null;
    coverageEnd: string | null;
  } | null,
) {
  const rangeStatus = coverage?.rangeDisplayStatus;
  return {
    status: sync.status,
    pageName: sync.pageName,
    profileImageUrl: sync.profileImageUrl,
    rangeStart: sync.rangeStart,
    rangeEnd: sync.rangeEnd,
    timezone: sync.timezone,
    partialData:
      sync.partialData ||
      rangeStatus === "partial" ||
      coverage?.dataCompleteness === "partial",
    lastAttemptAt: sync.lastAttemptAt,
    lastSuccessAt: sync.lastSuccessAt,
    lastErrorCategory: sync.lastErrorCategory,
    lastErrorMessage: sync.lastErrorMessage,
    retryCount: sync.retryCount,
    metricsAvailable: sync.metricsAvailable,
    lastConfirmedDate: sync.lastConfirmedDate ?? null,
    dataProvenance:
      rangeStatus === "partial" || sync.status === "degraded"
        ? "partial"
        : sync.status === "ready" && rangeStatus === "ready"
          ? "confirmed"
          : sync.status === "empty" || rangeStatus === "empty"
            ? "empty"
            : sync.status === "failed" ||
                sync.status === "action_required" ||
                rangeStatus === "unavailable"
              ? "unavailable"
              : "pending",
    dataCompleteness:
      coverage?.dataCompleteness ?? sync.dataCompleteness ?? "unknown",
    rangeDisplayStatus: rangeStatus ?? sync.status,
    rangeCoverageNotice: coverage?.notice ?? null,
    coverageEnd: coverage?.coverageEnd ?? null,
    lastSyncMode: sync.lastSyncMode ?? null,
    backfillStatus: sync.backfillStatus ?? null,
    operation: sync.operation ?? null,
  };
}

/**
 * Brand-scoped Facebook sync status — resolves canonical connection server-side.
 * No connectionId / accountId in the request URL.
 * Optional range query: ?range=last_7|last_30|last_90|current_month|previous_month|custom&compare=1&start=&end=
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_social");
  if (!gate.ok) {
    return gate.response;
  }

  const brand = await resolveBrandSessionContext(gate.access);
  const started = Date.now();
  const url = new URL(request.url);
  const preset = url.searchParams.get("range") ?? "last_30";
  const compare = url.searchParams.get("compare") === "1";
  const customStart = url.searchParams.get("start");
  const customEnd = url.searchParams.get("end");

  const coalesceKey = `${gate.access.activeClientId}:${brand.activeBrandId ?? "none"}:fb-sync-get:${preset}:${compare}:${customStart ?? ""}:${customEnd ?? ""}`;
  const existing = syncGetInFlight.get(coalesceKey);
  if (existing) {
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "dashboard_get",
      outcome: "coalesced",
      provider: "meta",
      msTotal: 0,
    });
    return existing;
  }

  const promise = (async (): Promise<NextResponse> => {
    try {
      await releaseExpiredFacebookPageSyncLeases({
        clientId: gate.access.activeClientId,
        limit: 5,
      });

      const resolved = await resolveCanonicalFacebookDashboard({
        clientId: gate.access.activeClientId,
        businessBrandId: brand.activeBrandId,
      });

      if (resolved.kind === "ambiguous") {
        return jsonResponse(
          {
            ok: false,
            message:
              "Multiple Facebook Page selections need attention. Open Manage connections to continue.",
            category: "ambiguous",
          },
          409,
        );
      }

      if (resolved.kind !== "ready") {
        return jsonResponse(
          {
            ok: false,
            message:
              "No selected Facebook Page was found for this brand.",
            category: "not_found",
          },
          404,
        );
      }

      const sync = await getSelectedFacebookPageSyncSnapshot({
        clientId: gate.access.activeClientId,
        businessBrandId: brand.activeBrandId!,
      });

      if (!sync) {
        return jsonResponse(
          {
            ok: false,
            message:
              "No selected Facebook Page was found for this brand.",
            category: "not_found",
          },
          404,
        );
      }

      const { resolveFacebookAnalyticsRange } = await import(
        "@/lib/social/sync/facebook-page-sync-schedule"
      );
      const allowedPresets = new Set([
        "last_7",
        "last_30",
        "last_90",
        "current_month",
        "previous_month",
        "custom",
      ]);
      const range = await clipAnalyticsDateRangeForClient(
        gate.access.activeClientId,
        resolveFacebookAnalyticsRange({
          preset: allowedPresets.has(preset)
            ? (preset as
                | "last_7"
                | "last_30"
                | "last_90"
                | "current_month"
                | "previous_month"
                | "custom")
            : "last_30",
          timezone: sync.timezone || "UTC",
          customStart,
          customEnd,
          compare,
        }),
      );

      const metrics =
        sync.status === "ready" ||
        sync.status === "degraded" ||
        sync.status === "empty"
          ? await listSelectedFacebookPageMetrics({
              clientId: gate.access.activeClientId,
              businessBrandId: brand.activeBrandId!,
              socialAccountId: resolved.socialAccountId,
              syncStatus: sync.status,
              partialData: sync.partialData,
              rangeStart: range.start,
              rangeEnd: range.end,
            })
          : [];

      const compareMetrics =
        range.compareStart &&
        range.compareEnd &&
        (sync.status === "ready" ||
          sync.status === "degraded" ||
          sync.status === "empty")
          ? await listSelectedFacebookPageMetrics({
              clientId: gate.access.activeClientId,
              businessBrandId: brand.activeBrandId!,
              socialAccountId: resolved.socialAccountId,
              syncStatus: sync.status,
              partialData: sync.partialData,
              rangeStart: range.compareStart,
              rangeEnd: range.compareEnd,
            })
          : [];

      const metricsEndInRange =
        metrics.length > 0
          ? metrics.reduce((latest, row) => {
              const hasConfirmed =
                (row.impressions != null &&
                  row.provenance.impressions !== "missing") ||
                (row.reach != null && row.provenance.reach !== "missing");
              if (!hasConfirmed) return latest;
              return row.date > latest ? row.date : latest;
            }, "")
          : null;

      const lifetimeFollowers =
        sync.status === "ready" ||
        sync.status === "degraded" ||
        sync.status === "empty"
          ? await resolveLifetimeFollowersSnapshot({
              clientId: gate.access.activeClientId,
              businessBrandId: brand.activeBrandId!,
              socialAccountId: resolved.socialAccountId,
              atOrBefore: range.end,
            })
          : null;

      const coverage = resolveFacebookSelectedRangeCoverage({
        selectedStart: range.start,
        selectedEnd: range.end,
        lastConfirmedDate: sync.lastConfirmedDate ?? null,
        syncedRangeEnd: sync.rangeEnd,
        metricsEndInRange: metricsEndInRange || null,
        syncStatus: sync.status,
        metricsAvailable: sync.metricsAvailable,
      });

      const viewsResolved = resolveViewsDisplayFromStoredDays({
        selectedStart: range.start,
        selectedEnd: range.end,
        coverageEnd: coverage.coverageEnd,
        days: metrics.map((row) => ({
          date: row.date,
          impressions: row.storedImpressions,
          metricSet: row.metricSet,
          fieldImpressions: row.fieldImpressions,
        })),
      });

      const viewsPoints = viewsResolved.chartPoints.map((point) => ({
        date: point.date,
        value: point.value,
        confirmed: point.confirmed,
      }));

      const reachPoints = metrics.map((row) => ({
        date: row.date,
        value: row.reach,
        confirmed:
          row.reach != null && row.provenance.reach !== "missing",
      }));

      const viewsSeries = buildCoveredMetricSeries({
        selectedStart: range.start,
        selectedEnd: range.end,
        coverageEnd: coverage.coverageEnd,
        points: viewsPoints,
      });

      const reachSubtotal = sumConfirmedDailyValues({
        selectedStart: range.start,
        selectedEnd: range.end,
        coverageEnd: coverage.coverageEnd,
        points: reachPoints,
      });

      const followersAcquiredPoints = metrics.map((row) => ({
        date: row.date,
        value: row.followersAcquired,
        confirmed:
          row.followersAcquired != null &&
          row.provenance.followersAcquired !== "missing",
      }));
      const followersLostPoints = metrics.map((row) => ({
        date: row.date,
        value: row.followersLost,
        confirmed:
          row.followersLost != null &&
          row.provenance.followersLost !== "missing",
      }));
      const contentPoints = metrics.map((row) => ({
        date: row.date,
        value: row.contentPublished,
        confirmed:
          row.contentPublished != null &&
          row.provenance.contentPublished !== "missing",
      }));

      const totalContentConfirmedEmpty = contentPoints.some(
        (point) => point.confirmed && point.value === 0,
      ) && !contentPoints.some(
        (point) => point.confirmed && (point.value ?? 0) > 0,
      );

      const metricCoverage = buildFacebookMetricCoverageMap({
        selectedStart: range.start,
        selectedEnd: range.end,
        coverageEnd: coverage.coverageEnd,
        viewsPoints,
        pageVisitsPoints: metrics.map((row) => ({
          date: row.date,
          value: row.pageVisits,
          confirmed:
            row.pageVisits != null &&
            row.provenance.pageVisits !== "missing",
        })),
        followersAcquiredPoints,
        followersLostPoints,
        contentPoints,
        engagementPoints: metrics.map((row) => ({
          date: row.date,
          value: row.engagement,
          confirmed:
            row.engagement != null &&
            row.provenance.engagement !== "missing",
        })),
        totalContentConfirmedEmpty,
        lifetimeFollowers: lifetimeFollowers
          ? {
              value: lifetimeFollowers.value,
              date: lifetimeFollowers.date,
              provenance: lifetimeFollowers.provenance,
            }
          : null,
      });

      const netFromFollows = deriveNetFollowerChangeFromDailyFollows({
        selectedStart: range.start,
        selectedEnd: range.end,
        coverageEnd: coverage.coverageEnd,
        acquiredPoints: followersAcquiredPoints,
        lostPoints: followersLostPoints,
      });

      metricCoverage.growth_net_followers =
        netFromFollows.status === "confirmed"
          ? {
              value: netFromFollows.value,
              coveredThrough: netFromFollows.coveredThrough,
              isPartial:
                coverage.coverageEnd != null &&
                range.end > coverage.coverageEnd &&
                (netFromFollows.coveredThrough ?? "") < range.end,
              provenance: "confirmed",
              status:
                coverage.coverageEnd != null &&
                range.end > coverage.coverageEnd
                  ? "partial"
                  : "ready",
              notice: null,
            }
          : {
              value: null,
              coveredThrough: null,
              isPartial: false,
              provenance: "unavailable",
              status: "unavailable",
              notice:
                netFromFollows.status === "incomplete"
                  ? "Net follower change is incomplete until acquired and lost series share the same coverage."
                  : "Net follower change requires confirmed daily acquired and lost follow rows.",
            };

      // Authoritative Views provenance (rejects legacy unattested impressions sum).
      metricCoverage.views = {
        value: viewsResolved.cardValue,
        coveredThrough: viewsResolved.coveredThrough,
        coveredFrom: viewsResolved.coveredFrom,
        isPartial: viewsResolved.isPartial,
        provenance:
          viewsResolved.cardValue == null ? "unavailable" : "confirmed",
        status:
          viewsResolved.cardValue == null
            ? "unavailable"
            : viewsResolved.isPartial
              ? "partial"
              : "ready",
        notice: viewsResolved.notice,
        kind: viewsResolved.cardKind,
        chartAvailable: viewsResolved.chartAvailable,
        rejectedLegacyPeriodTotal: viewsResolved.rejectedLegacyPeriodTotal,
      };

      // Attach unique media views subtotal with the same partial rules as views.
      if (reachSubtotal.total != null) {
        const reachPartial =
          coverage.coverageEnd != null &&
          range.end > coverage.coverageEnd &&
          (reachSubtotal.coveredThrough ?? coverage.coverageEnd) < range.end;
        metricCoverage.unique_media_views = {
          value: reachSubtotal.total,
          coveredThrough:
            reachSubtotal.coveredThrough ?? coverage.coverageEnd,
          isPartial: reachPartial,
          provenance: "confirmed",
          status: reachPartial ? "partial" : "ready",
          notice: reachPartial
            ? `Showing confirmed data through ${reachSubtotal.coveredThrough ?? coverage.coverageEnd}. Days after that are not synchronized yet.`
            : null,
        };
      }

      const growthViewState = metricCoverage.views.status;

      // Never ship raw storedImpressions to the client — only attested impressions.
      const metricsForClient = metrics.map(
        ({ storedImpressions: _stored, ...row }) => row,
      );
      const compareMetricsForClient = compareMetrics.map(
        ({ storedImpressions: _stored, ...row }) => row,
      );

      logSocialOAuthEvent("facebook-page-sync", {
        stage: "dashboard_get",
        outcome: sync.status,
        provider: "meta",
        msTotal: Date.now() - started,
      });

      return jsonResponse(
        {
          ok: true,
          sync: syncClientPayload(sync, coverage),
          metrics: metricsForClient,
          range,
          compareMetrics: compareMetricsForClient,
          coverage,
          lifetimeFollowers: lifetimeFollowers
            ? {
                value: lifetimeFollowers.value,
                date: lifetimeFollowers.date,
                metaField: lifetimeFollowers.metaField,
                provenance: lifetimeFollowers.provenance,
                dateAttribution: lifetimeFollowers.dateAttribution,
                storedDate: lifetimeFollowers.storedDate ?? null,
              }
            : null,
          viewsSeries,
          viewsTotal: viewsResolved.cardValue,
          netFollowerChange: netFromFollows.value,
          viewsProvenance: {
            kind: viewsResolved.cardKind,
            coveredFrom: viewsResolved.coveredFrom,
            coveredThrough: viewsResolved.coveredThrough,
            chartAvailable: viewsResolved.chartAvailable,
            rejectedLegacyPeriodTotal:
              viewsResolved.rejectedLegacyPeriodTotal,
          },
          uniqueMediaViewsTotal: reachSubtotal.total,
          metricCoverage,
          metricCompleteness: Object.fromEntries(
            Object.entries(metricCoverage).map(([key, row]) => [
              key,
              { status: row.status, notice: row.notice },
            ]),
          ),
          views: {
            overview: growthViewState,
            growth: growthViewState,
            lifetime_followers: metricCoverage.lifetime_followers.status,
            demographics: metricCoverage.demographics.status,
            posts: metricCoverage.posts.status,
            reels: metricCoverage.reels.status,
            stories: metricCoverage.stories.status,
            engagement: metricCoverage.engagement.status,
            balance_of_followers:
              metricCoverage.followers_acquired.status === "unavailable" &&
              metricCoverage.followers_lost.status === "unavailable"
                ? "unavailable"
                : growthViewState,
            reactions: metricCoverage.reactions.status,
            page_visits: metricCoverage.page_visits.status,
            total_content: metricCoverage.total_content.status,
          },
        },
        200,
      );
    } catch (error) {
      return handleApiError(
        "facebook-page-sync-get",
        error,
        "Facebook Page sync status could not be loaded.",
      );
    } finally {
      syncGetInFlight.delete(coalesceKey);
    }
  })();

  syncGetInFlight.set(coalesceKey, promise);
  return promise;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission(
    "manage_social_accounts",
  );
  if (!gate.ok) {
    return gate.response;
  }

  const brand = await resolveBrandSessionContext(gate.access);
  const started = Date.now();

  if (!brand.activeBrandId) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose an active brand before syncing Facebook.",
        category: "brand_required",
      },
      400,
    );
  }

  let resume = false;
  try {
    const body = (await request.json()) as { resume?: unknown };
    resume = body.resume === true;
  } catch {
    // optional
  }

  try {
    const resolved = await resolveCanonicalFacebookDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    if (resolved.kind === "ambiguous") {
      return jsonResponse(
        {
          ok: false,
          message:
            "Multiple Facebook Page selections need attention. Open Manage connections to continue.",
          category: "ambiguous",
        },
        409,
      );
    }

    if (resolved.kind !== "ready") {
      return jsonResponse(
        {
          ok: false,
          message:
            "No selected Facebook Page was found for this brand.",
          category: "not_found",
        },
        404,
      );
    }

    const current = await getSelectedFacebookPageSyncSnapshot({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    if (current?.lastErrorCategory === "authorization_expired") {
      const prisma = getPrisma();
      const shell = prisma
        ? await prisma.socialProviderConnection.findFirst({
            where: {
              id: resolved.connectionId,
              clientId: gate.access.activeClientId,
              provider: "meta",
            },
            select: {
              status: true,
              credential: { select: { status: true } },
            },
          })
        : null;

      const canRetryWithCurrentCredential =
        shell?.status === "connected" &&
        shell.credential?.status === "active";

      // Hard-block only when the Meta shell itself is not usable.
      // Fresh connect / reconnect that left a stale sync auth error must be
      // allowed to claim+enqueue again instead of forcing another OAuth loop.
      if (!canRetryWithCurrentCredential) {
        return jsonResponse(
          {
            ok: false,
            message:
              "Facebook authorization expired. Reconnect to continue.",
            category: "authorization_expired",
            sync: current ? syncClientPayload(current) : null,
          },
          409,
        );
      }

      if (prisma) {
        await prisma.socialProviderConnection.updateMany({
          where: {
            id: resolved.connectionId,
            clientId: gate.access.activeClientId,
            lastErrorCode: {
              in: [
                "authorization_expired",
                "reauthorization_pending",
                "reauthorization_failed",
                "oauth_callback_failed",
              ],
            },
          },
          data: {
            lastErrorCode: null,
            lastErrorMessage: null,
            lastErrorAt: null,
          },
        });
      }
    }

    const sync = await enqueueInitialFacebookPageSync({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId: resolved.connectionId,
      socialAccountId: resolved.socialAccountId,
      businessBrandId: brand.activeBrandId,
      resume,
    });

    if (!sync) {
      return jsonResponse(
        {
          ok: false,
          message: "Facebook Page sync could not be started.",
          category: "unavailable",
        },
        503,
      );
    }

    logSocialOAuthEvent("facebook-page-sync", {
      stage: "dashboard_post",
      outcome: sync.status,
      provider: "meta",
      msTotal: Date.now() - started,
    });

    return jsonResponse(
      {
        ok: true,
        sync: syncClientPayload(sync),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-page-sync-post",
      error,
      "Facebook Page sync could not be started.",
    );
  }
}
