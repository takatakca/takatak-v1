import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { cronAuthorized } from "@/lib/growth/cron-auth";
import { runDueMonthlySchedules } from "@/lib/reports/build-monthly";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Builds the automatic monthly reports that are due (the 1st of each month)
 * and delivers them in each client's dashboard. Call hourly. A schedule is
 * claimed before it runs, so overlapping ticks never build a month twice.
 * Auth: Authorization: Bearer <CRON_SECRET> (or x-cron-secret).
 */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!cronAuthorized(request.headers)) return jsonResponse({ ok: false, message: "Unauthorized cron request." }, 401);
  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "Database unavailable." }, 503);
  try {
    const results = await runDueMonthlySchedules(prisma, { max: 10 });
    return jsonResponse({ ok: true, built: results.filter((r) => r.reportId).length, failed: results.filter((r) => !r.reportId).length }, 200);
  } catch (error) {
    console.error("[cron:monthly-reports] failed:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({ ok: false, message: "Monthly reports failed." }, 500);
  }
}

export const GET = handle;
export const POST = handle;
