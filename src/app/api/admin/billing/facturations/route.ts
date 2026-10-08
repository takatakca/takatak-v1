import { NextResponse } from "next/server";

import { getFacturationsOverview } from "@/lib/billing/invoices/facturations-overview";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GROUPE TAKATAK Billing — Facturations connection status (platform admin).
// Returns presence metadata and DRAFT-only summaries; never secrets.
export async function GET(): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();

  if (!access.ok) {
    return access.response;
  }

  try {
    const overview = await getFacturationsOverview({
      profileId: access.profileId,
      role: access.role,
    });

    return jsonResponse({ ok: true, overview }, 200);
  } catch (error) {
    return handleApiError(
      "billing-facturations-status",
      error,
      "Facturations status is unavailable.",
    );
  }
}
