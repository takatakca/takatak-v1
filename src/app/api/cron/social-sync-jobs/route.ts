import {
  NextRequest,
  NextResponse,
} from "next/server";

import { jsonResponse } from "@/lib/security/api-response";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { runFacebookPageSyncWorkerTick } from "@/lib/social/sync/facebook-page-sync-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Independent scheduled consumer for Facebook Page sync_analytics jobs.
 * Delivery guarantee for queued/retrying/expired-lease work — does not
 * depend on a user revisiting the dashboard or on Next.js after().
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 * Local/dev without CRON_SECRET: allowed only when NODE_ENV !== production.
 */
function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");
  const bearer =
    header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const alt = request.headers.get("x-cron-secret")?.trim() ?? "";

  if (secret) {
    return bearer === secret || alt === secret;
  }

  return process.env.NODE_ENV !== "production";
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!authorizeCron(request)) {
    return jsonResponse(
      { ok: false, message: "Unauthorized cron request." },
      401,
    );
  }

  const started = Date.now();

  try {
    const schedule = await import(
      "@/lib/social/sync/facebook-page-sync-schedule"
    );
    const scheduled = await schedule.scheduleDueFacebookPageIncrementalSyncs({
      limit: 10,
    });

    const result = await runFacebookPageSyncWorkerTick({
      limit: 5,
      processJobs: true,
    });

    const { runFacebookCompetitorWorkerTick } = await import(
      "@/lib/social/sync/facebook-competitor-sync-job"
    );
    const competitors = await runFacebookCompetitorWorkerTick({
      limit: 5,
      processJobs: true,
    });

    logSocialOAuthEvent("facebook-page-sync", {
      stage: "cron",
      outcome: "ok",
      provider: "meta",
      writeCreated: result.claimed + scheduled.enqueued + competitors.scheduled,
      writeUpdated: result.completed + competitors.completed,
      writeUnchanged: result.released + scheduled.skipped,
      malformedCount: result.failed + competitors.failed,
      msTotal: Date.now() - started,
    });

    return jsonResponse(
      {
        ok: true,
        scheduled: scheduled.enqueued,
        claimed: result.claimed,
        completed: result.completed,
        released: result.released,
        failed: result.failed,
        competitors,
      },
      200,
    );
  } catch {
    logSocialOAuthEvent("facebook-page-sync", {
      stage: "cron",
      outcome: "failed",
      provider: "meta",
      msTotal: Date.now() - started,
    });

    return jsonResponse(
      {
        ok: false,
        message: "Social sync worker tick failed.",
      },
      500,
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
