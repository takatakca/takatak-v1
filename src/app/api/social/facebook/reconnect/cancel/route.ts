import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { cancelMetaFacebookReauthorization } from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cancel an unfinished Facebook reconnect without disconnecting the Page.
 */
export async function POST(): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission(
    "manage_social_accounts",
  );

  if (!gate.ok) {
    return gate.response;
  }

  const brand = await resolveBrandSessionContextFromRequest(gate.access);
  if (!brand.activeBrandId) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose an active brand before cancelling reconnect.",
        category: "brand_required",
      },
      400,
    );
  }

  try {
    const result = await cancelMetaFacebookReauthorization({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      businessBrandId: brand.activeBrandId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/facebook");

    logSocialOAuthEvent("facebook-reconnect-cancel", {
      stage: "cancel",
      outcome: result.cancelled ? "cancelled" : "noop",
      provider: "meta",
      mode: "reauthorization",
    });

    return jsonResponse(
      {
        ok: true,
        message: result.cancelled
          ? "Facebook reconnect was cancelled. Your Page stays connected."
          : "There was no Facebook reconnect in progress.",
        cancelled: result.cancelled,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-reconnect-cancel",
      error,
      "Facebook reconnect could not be cancelled.",
    );
  }
}
