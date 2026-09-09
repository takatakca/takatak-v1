import { NextRequest } from "next/server";

import { startSocialStripePortal } from "@/lib/billing/social/stripe-service";
import { originFromRequest } from "@/lib/config/app-origin";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_settings");

  if (!gate.ok) {
    return gate.response;
  }

  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  try {
    const result = await startSocialStripePortal({
      clientId: gate.access.activeClientId,
      requestOrigin: originFromRequest(request),
    });

    return jsonResponse(
      {
        ok: true,
        url: result.url,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "billing-stripe-portal",
      error,
      "The Stripe customer portal could not be opened.",
    );
  }
}
