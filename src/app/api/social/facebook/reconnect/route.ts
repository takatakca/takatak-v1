import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { startMetaFacebookReauthorization } from "@/lib/social/connections/social-connection-service";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Brand-scoped Facebook reconnect — no connectionId / accountId in the URL.
 * Does not enqueue Page sync; OAuth must succeed first.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission(
    "manage_social_accounts",
  );

  if (!gate.ok) {
    return gate.response;
  }

  const brand = await resolveBrandSessionContext(gate.access);
  if (!brand.activeBrandId) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose an active brand before reconnecting Facebook.",
        category: "brand_required",
      },
      400,
    );
  }

  let returnPath = "/dashboard/social/facebook";
  try {
    const body = (await request.json()) as { returnPath?: unknown };
    if (
      typeof body.returnPath === "string" &&
      body.returnPath.startsWith("/dashboard/social")
    ) {
      // Strip accountId if a client still sends one.
      const url = new URL(body.returnPath, "https://takatak.local");
      url.searchParams.delete("accountId");
      returnPath = `${url.pathname}${url.search}`;
    }
  } catch {
    // optional body
  }

  try {
    const authorization = await startMetaFacebookReauthorization({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      businessBrandId: brand.activeBrandId,
      returnPath,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/facebook");

    logSocialOAuthEvent("facebook-reconnect", {
      stage: "start",
      outcome: "pending_redirect",
      provider: "meta",
      mode: "reauthorization",
    });

    return jsonResponse(
      {
        ok: true,
        message: "Continue to Facebook to renew authorization.",
        authorization: {
          authorizationUrl: authorization.authorizationUrl,
          expiresAt: authorization.expiresAt,
          provider: authorization.provider,
          mode: authorization.mode,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-reconnect",
      error,
      "Facebook could not be reconnected.",
    );
  }
}
