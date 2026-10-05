import { NextRequest, NextResponse } from "next/server";

import { updateAdsCampaignStatus } from "@/lib/ads/management-service";
import { validateAdsCampaignStatus } from "@/lib/ads/management-validation";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_ads");
  if (!gate.ok) return gate.response;

  const { campaignId } = await context.params;
  if (!campaignId) {
    return jsonResponse(
      { ok: false, message: "Campaign id is required." },
      400,
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateAdsCampaignStatus(bodyResult.body);
  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message: validation.message,
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const campaign = await updateAdsCampaignStatus(
      gate.access.activeClientId,
      campaignId,
      validation.data.status,
    );
    return jsonResponse(
      {
        ok: true,
        message: "TAKATAK ADS campaign status updated.",
        campaign,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "ads-campaign-status",
      error,
      "The campaign status could not be updated.",
    );
  }
}
