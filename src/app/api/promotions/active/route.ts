import { NextResponse } from "next/server";

import { listActiveCampaigns } from "@/lib/promotions/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — running time-limited campaigns (code, percent, end date) for the public countdown. */
export async function GET(): Promise<NextResponse> {
  const now = new Date();
  return NextResponse.json(
    { ok: true, now: now.toISOString(), campaigns: listActiveCampaigns(now) },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
