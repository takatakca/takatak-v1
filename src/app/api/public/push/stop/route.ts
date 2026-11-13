import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";
import { stopPushSubscription } from "@/lib/push/store";
import { jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stop alerts on this device. The endpoint is the credential: only the browser
 * that subscribed knows it. Works even if push sending is switched off.
 */
export async function POST(request: NextRequest) {
  const leads = readWebsiteLeadsConfig();
  if (!leads.enabled) return jsonResponse({ ok: false, code: "not_enabled" }, 503);
  const body = await readJsonBody(request, 2_048);
  if (!body.ok) return jsonResponse({ ok: false, code: "invalid_request" }, body.status);
  const endpoint = (body.body as Record<string, unknown> | null)?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) {
    return jsonResponse({ ok: false, code: "invalid_fields" }, 400);
  }
  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  await stopPushSubscription(prisma, { clientId: leads.clientId, endpoint, by: "person" });
  // Same answer whether it existed or not.
  return jsonResponse({ ok: true }, 200);
}
