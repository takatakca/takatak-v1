import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { loadBrandSelectorSnapshots } from "@/lib/security/brand-context";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live brand-selector snapshot for the social top bar.
 * Omits Page IDs, connection IDs, tokens, and provider secrets.
 * Coalescing + short cache live inside loadBrandSelectorSnapshots.
 */
export async function GET(
  _request: NextRequest,
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission(
    "view_social",
  );

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const started = Date.now();
    const brands = await loadBrandSelectorSnapshots(
      gate.access.activeClientId,
    );

    logSocialOAuthEvent("social-brand-selector", {
      stage: "route",
      outcome: "ok",
      msTotal: Date.now() - started,
      rawCount: brands.length,
    });

    return jsonResponse(
      {
        ok: true,
        brands: brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          status: brand.status,
          imageUrl: brand.imageUrl,
          displayImageUrl: brand.displayImageUrl,
          displayLabel: brand.displayLabel,
          connectedPlatforms: brand.connectedPlatforms,
        })),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-brand-selector",
      error,
      "Brand selector data could not be loaded.",
    );
  }
}
