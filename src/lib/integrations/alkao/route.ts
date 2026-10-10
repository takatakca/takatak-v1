import "server-only";

import { NextResponse } from "next/server";

import { loadAlkaoSyncConfig, runAlkaoSync } from "./sync";

/**
 * POST /api/integrations/alkao/sync[?dryRun=1]. Call it on a schedule, like the existing
 * cron routes, with `Authorization: Bearer <CRON_SECRET>`. Without the ALKAO settings it
 * answers 503 and does nothing.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  return bearer === secret || (request.headers.get("x-cron-secret")?.trim() ?? "") === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  const config = loadAlkaoSyncConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "ALKAO sync is not configured." }, { status: 503 });
  }
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const result = await runAlkaoSync(config, { dryRun });
    console.info("[alkao-sync]", JSON.stringify({ dryRun, planned: result.planned.length, sent: result.sent.length, ok: result.ok }));
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    console.error("[alkao-sync] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "ALKAO sync failed." }, { status: 502 });
  }
}
