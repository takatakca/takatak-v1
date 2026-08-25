import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { isUuid } from "@/lib/validation/common";
import {
  enqueueInitialFacebookPageSync,
  getSelectedFacebookPageSyncSnapshot,
  listSelectedFacebookPageMetrics,
} from "@/lib/social/sync/facebook-page-initial-sync";
import {
  releaseExpiredFacebookPageSyncLeases,
} from "@/lib/social/sync/facebook-page-sync-job";
import { getPrisma } from "@/lib/db/prisma";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const syncGetInFlight = new Map<string, Promise<NextResponse>>();

function syncClientPayload(
  sync: NonNullable<
    Awaited<ReturnType<typeof getSelectedFacebookPageSyncSnapshot>>
  >,
) {
  return {
    status: sync.status,
    pageName: sync.pageName,
    profileImageUrl: sync.profileImageUrl,
    rangeStart: sync.rangeStart,
    rangeEnd: sync.rangeEnd,
    timezone: sync.timezone,
    partialData: sync.partialData,
    lastAttemptAt: sync.lastAttemptAt,
    lastSuccessAt: sync.lastSuccessAt,
    lastErrorCategory: sync.lastErrorCategory,
    lastErrorMessage: sync.lastErrorMessage,
    retryCount: sync.retryCount,
    metricsAvailable: sync.metricsAvailable,
    dataProvenance:
      sync.status === "ready"
        ? "confirmed"
        : sync.status === "degraded"
          ? "partial"
          : sync.status === "empty"
            ? "empty"
            : sync.status === "failed" ||
                sync.status === "action_required"
              ? "unavailable"
              : "pending",
    operation: sync.operation ?? null,
  };
}

async function resolveSelectedAccount(options: {
  clientId: string;
  connectionId: string;
}): Promise<{
  socialAccountId: string;
  businessBrandId: string;
} | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "facebook",
      accountType: "facebook_page",
      status: "connected",
      accessStatus: "selected",
      businessBrandId: { not: null },
    },
    select: {
      id: true,
      businessBrandId: true,
    },
  });

  if (!account?.businessBrandId) {
    return null;
  }

  return {
    socialAccountId: account.id,
    businessBrandId: account.businessBrandId,
  };
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ connectionId: string }>;
  },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_social");

  if (!gate.ok) {
    return gate.response;
  }

  const { connectionId } = await context.params;
  const started = Date.now();

  if (!isUuid(connectionId)) {
    return jsonResponse(
      {
        ok: false,
        message: "The selected social connection identifier is invalid.",
      },
      400,
    );
  }

  const coalesceKey = `${gate.access.activeClientId}:${connectionId}:get`;
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
      // Lease recovery only — Meta processing is the cron worker's job.
      await releaseExpiredFacebookPageSyncLeases({
        clientId: gate.access.activeClientId,
        limit: 5,
      });

      const selectedStarted = Date.now();
      const selected = await resolveSelectedAccount({
        clientId: gate.access.activeClientId,
        connectionId,
      });
      const msSelected = Date.now() - selectedStarted;

      if (!selected) {
        return jsonResponse(
          {
            ok: false,
            message:
              "No selected Facebook Page was found for this connection.",
            category: "not_found",
          },
          404,
        );
      }

      const syncStarted = Date.now();
      const sync = await getSelectedFacebookPageSyncSnapshot({
        clientId: gate.access.activeClientId,
        businessBrandId: selected.businessBrandId,
      });
      const msSync = Date.now() - syncStarted;

      if (!sync || sync.connectionId !== connectionId) {
        return jsonResponse(
          {
            ok: false,
            message:
              "No selected Facebook Page was found for this connection.",
            category: "not_found",
          },
          404,
        );
      }

      const metricsStarted = Date.now();
      const metrics =
        sync.status === "ready" ||
        sync.status === "degraded" ||
        sync.status === "empty"
          ? await listSelectedFacebookPageMetrics({
              clientId: gate.access.activeClientId,
              businessBrandId: selected.businessBrandId,
              socialAccountId: selected.socialAccountId,
              syncStatus: sync.status,
              partialData: sync.partialData,
            })
          : [];
      const msMetrics = Date.now() - metricsStarted;

      logSocialOAuthEvent("facebook-page-sync", {
        stage: "dashboard_get",
        outcome: sync.status,
        provider: "meta",
        msAuth: msSelected,
        msValidate: msSync,
        msUpsert: msMetrics,
        msTotal: Date.now() - started,
      });

      return jsonResponse(
        {
          ok: true,
          sync: syncClientPayload(sync),
          metrics,
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

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ connectionId: string }>;
  },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission(
    "manage_social_accounts",
  );

  if (!gate.ok) {
    return gate.response;
  }

  const { connectionId } = await context.params;
  const started = Date.now();

  if (!isUuid(connectionId)) {
    return jsonResponse(
      {
        ok: false,
        message: "The selected social connection identifier is invalid.",
      },
      400,
    );
  }

  let resume = false;
  try {
    const body = (await request.json()) as { resume?: unknown };
    resume = body.resume === true;
  } catch {
    // optional body
  }

  try {
    const selected = await resolveSelectedAccount({
      clientId: gate.access.activeClientId,
      connectionId,
    });

    if (!selected) {
      return jsonResponse(
        {
          ok: false,
          message: "No selected Facebook Page was found for this connection.",
          category: "not_found",
        },
        404,
      );
    }

    // Durable claim + Job row + after() schedule. Never await Meta here.
    const sync = await enqueueInitialFacebookPageSync({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
      socialAccountId: selected.socialAccountId,
      businessBrandId: selected.businessBrandId,
      resume,
    });

    if (!sync || sync.connectionId !== connectionId) {
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
        message:
          sync.status === "syncing"
            ? "Facebook Page sync is running."
            : sync.status === "failed"
              ? sync.lastErrorMessage ??
                "Facebook Page sync could not be started. You can retry."
              : sync.lastErrorMessage ??
                "Facebook Page sync status updated.",
        sync: syncClientPayload(sync),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-page-sync-run",
      error,
      "Facebook Page sync could not be started.",
    );
  }
}
