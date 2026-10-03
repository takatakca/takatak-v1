import { NextRequest, NextResponse } from "next/server";

import { updateAdsCreativeStatus } from "@/lib/ads/management-service";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = [
  "draft",
  "active",
  "paused",
  "rejected",
  "archived",
] as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ creativeId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_ads");
  if (!gate.ok) return gate.response;

  const { creativeId } = await context.params;
  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const raw =
    bodyResult.body &&
    typeof bodyResult.body === "object" &&
    !Array.isArray(bodyResult.body)
      ? (bodyResult.body as Record<string, unknown>)
      : {};
  const status =
    typeof raw.status === "string" &&
    (ALLOWED as readonly string[]).includes(raw.status)
      ? (raw.status as (typeof ALLOWED)[number])
      : null;

  if (!status) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose a valid creative status.",
        fieldErrors: { status: "Creative status is invalid." },
      },
      400,
    );
  }

  try {
    const creative = await updateAdsCreativeStatus(
      gate.access.activeClientId,
      creativeId,
      status,
    );
    return jsonResponse(
      {
        ok: true,
        message: "TAKATAK ADS creative status updated.",
        creative,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "ads-creative-status",
      error,
      "The creative status could not be updated.",
    );
  }
}
