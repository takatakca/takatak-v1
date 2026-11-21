import { NextRequest, NextResponse } from "next/server";

import { nativeRunnerEnabled, runNativeAgentBatch } from "@/lib/ai-agents/native-runner";
import { scheduleDueAgentRuns } from "@/lib/ai-agents/service";
import { cronAuthorized } from "@/lib/growth/cron-auth";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Enqueues due autopilot agent runs (daily/weekly schedules, client time zone),
 * then, while no external AI Gateway is configured, runs up to two waiting
 * Chat Concierge / Social Autopilot runs on the connected engines.
 * Call every 15 minutes. Each slot is enqueued at most once even if ticks overlap.
 * Auth: Authorization: Bearer <CRON_SECRET> (or x-cron-secret). Without a
 * secret it only runs outside production, matching the existing cron routes.
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!cronAuthorized(request.headers)) return jsonResponse({ ok: false, message: "Unauthorized cron request." }, 401);
  try {
    const result = await scheduleDueAgentRuns();
    // Without the external AI Gateway, agents run here on the connected engines.
    const native = nativeRunnerEnabled() ? await runNativeAgentBatch({ max: 2 }) : [];
    return jsonResponse({ ok: true, ...result, native: native.map(({ agentKey, phase, outcome }) => ({ agentKey, phase, outcome })) }, 200);
  } catch (error) {
    console.error("[cron:growth-agents] failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ ok: false, message: "Scheduling failed." }, 500);
  }
}

export const GET = handle;
export const POST = handle;
