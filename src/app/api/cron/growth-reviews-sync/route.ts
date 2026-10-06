import { NextRequest, NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { cronAuthorized } from "@/lib/growth/cron-auth";
import { syncGoogleReviews } from "@/lib/integrations/google-business/service";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Hourly: imports new Google reviews for every connected client (oldest sync first). */
async function handle(request: NextRequest): Promise<NextResponse> {
  if (!cronAuthorized(request.headers)) return jsonResponse({ ok: false, message: "Unauthorized cron request." }, 401);
  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "Database unavailable." }, 503);
  const started = Date.now();
  const connections = await prisma.googleBusinessConnection.findMany({
    where: { status: { in: ["active", "error"] } },
    orderBy: [{ lastSyncAt: { sort: "asc", nulls: "first" } }],
    take: 25,
    select: { clientId: true },
  });
  let imported = 0;
  let failed = 0;
  for (const c of connections) {
    if (Date.now() - started > 50_000) break;
    try {
      const result = await syncGoogleReviews(c.clientId);
      imported += result.imported;
      if (!result.ok) failed += 1;
    } catch {
      failed += 1;
    }
  }
  return jsonResponse({ ok: true, connections: connections.length, imported, failed }, 200);
}

export const GET = handle;
export const POST = handle;
