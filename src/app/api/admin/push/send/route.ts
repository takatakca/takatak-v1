import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { listActiveCampaigns, normalizePromoCode } from "@/lib/promotions/catalog";
import { readPushConfig } from "@/lib/push/config";
import { sendPushToAll } from "@/lib/push/send";
import { activePushTargets, stopPushSubscription } from "@/lib/push/store";
import { jsonResponse } from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Platform admins only: announce a live campaign to every active device.
 * Refused unless the code is a campaign live in the server catalog right now,
 * so no alert can announce an offer that does not exist.
 */
export async function POST(request: NextRequest) {
  const access = await requirePlatformAdminApiAccess();
  if (!access.ok) return access.response;

  const config = readPushConfig();
  if (!config.enabled) return jsonResponse({ ok: false, code: "not_enabled", missing: config.missing }, 503);

  const body = await readJsonBody(request, 1_024);
  if (!body.ok) return jsonResponse({ ok: false, code: "invalid_request" }, body.status);
  const code = normalizePromoCode((body.body as Record<string, unknown> | null)?.code);
  const campaign = code ? listActiveCampaigns().find((c) => c.code === code) : null;
  if (!campaign) return jsonResponse({ ok: false, code: "no_live_campaign" }, 409);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);

  const targets = await activePushTargets(prisma, config.clientId);
  const report = await sendPushToAll(targets, config.vapid);
  for (const endpoint of report.gone) {
    await stopPushSubscription(prisma, { clientId: config.clientId, endpoint, by: "push_service" });
  }
  await prisma.auditLog.create({
    data: {
      clientId: config.clientId,
      profileId: access.profileId,
      action: "push_campaign_sent",
      entityType: "Campaign",
      entityId: campaign.code,
      metadata: { targets: targets.length, sent: report.sent, removed: report.gone.length, failed: report.failed },
    },
  });
  return jsonResponse({ ok: true, campaign: campaign.code, targets: targets.length, sent: report.sent, removed: report.gone.length, failed: report.failed }, 200);
}
