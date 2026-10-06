import { createHash, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { scheduleDueAgentRuns } from "@/lib/ai-agents/service";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Enqueues due autopilot agent runs (daily/weekly schedules, client time zone).
 * Call every 15 minutes. Each slot is enqueued at most once even if ticks overlap.
 * Auth: Authorization: Bearer <CRON_SECRET> (or x-cron-secret). Without a
 * secret it only runs outside production, matching the existing cron routes.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : (request.headers.get("x-cron-secret")?.trim() ?? "");
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(secret).digest();
  return Boolean(presented) && timingSafeEqual(a, b);
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) return jsonResponse({ ok: false, message: "Unauthorized cron request." }, 401);
  try {
    const result = await scheduleDueAgentRuns();
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    console.error("[cron:growth-agents] failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ ok: false, message: "Scheduling failed." }, 500);
  }
}

export const GET = handle;
export const POST = handle;
