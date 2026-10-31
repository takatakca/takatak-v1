import { NextResponse } from "next/server";

import { listActiveCampaigns } from "@/lib/promotions/catalog";

export const dynamic = "force-dynamic";

/**
 * What the service worker shows when a push arrives: the live campaign from
 * the server catalog (soonest to end), or nothing. Public data only.
 */
export async function GET() {
  const campaign = listActiveCampaigns()[0] ?? null;
  const response = NextResponse.json({ ok: true, campaign });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
