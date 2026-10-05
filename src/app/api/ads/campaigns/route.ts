import { NextRequest, NextResponse } from "next/server";

import {
  createAdsCampaign,
  getAdsWorkspaceSnapshot,
} from "@/lib/ads/management-service";
import { validateCreateAdsCampaign } from "@/lib/ads/management-validation";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_ads");
  if (!gate.ok) return gate.response;

  try {
    const data = await getAdsWorkspaceSnapshot(
      gate.access.activeClientId,
    );
    return jsonResponse({ ok: true, ...data }, 200);
  } catch (error) {
    return handleApiError(
      "ads-campaigns-list",
      error,
      "TAKATAK ADS campaigns could not be loaded.",
    );
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_ads");
  if (!gate.ok) return gate.response;

  const bodyResult = await readJsonBody(request, 64_000);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateCreateAdsCampaign(bodyResult.body);
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
    const campaign = await createAdsCampaign(
      gate.access.activeClientId,
      validation.data,
    );
    return jsonResponse(
      {
        ok: true,
        message: "TAKATAK ADS campaign created as a draft.",
        campaign,
      },
      201,
    );
  } catch (error) {
    return handleApiError(
      "ads-campaigns-create",
      error,
      "The TAKATAK ADS campaign could not be created.",
    );
  }
}
