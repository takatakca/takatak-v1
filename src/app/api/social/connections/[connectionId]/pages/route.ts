import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import {
  discoverFacebookPages,
  facebookPageErrorCategory,
} from "@/lib/social/connections/social-facebook-page-service";
import { MetaPageDiscoveryError } from "@/lib/social/providers/meta-pages";
import { toAccountPictureSrc } from "@/lib/social/media/remote-image";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{
      connectionId: string;
    }>;
  },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission(
    "manage_social_accounts",
  );

  if (!gate.ok) {
    return gate.response;
  }

  const { connectionId } = await context.params;

  if (!isUuid(connectionId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected social connection identifier is invalid.",
      },
      400,
    );
  }

  try {
    const discovery = await discoverFacebookPages({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    return jsonResponse(
      {
        ok: true,
        message: discovery.empty
          ? "No manageable Facebook Pages were found for this authorization."
          : "Facebook Pages were loaded for selection.",
        discovery: {
          connectionId: discovery.connectionId,
          connectionStatus: discovery.connectionStatus,
          empty: discovery.empty,
          // Facebook Page IDs stay server-side for selection validation.
          // Clients receive only user-meaningful identity + Takatak socialAccountId.
          pages: discovery.pages.map((page) => ({
            socialAccountId: page.socialAccountId,
            name: page.name,
            category: page.category,
            profileImageUrl: toAccountPictureSrc(page.socialAccountId),
            selectable: page.selectable,
            connectionEligible: page.connectionEligible,
            fullyManageable: page.fullyManageable,
            capabilityClass: page.capabilityClass,
            canReadEngagement: page.canReadEngagement,
            canPublish: page.canPublish,
            canModerate: page.canModerate,
            limitationLabel: page.limitationLabel,
            unavailableReason: page.unavailableReason,
            isCurrentSelection: page.isCurrentSelection,
          })),
          diagnostics: {
            authorizationMode:
              discovery.diagnostics.authorizationMode,
            grantedScopeClassification:
              discovery.diagnostics.grantedScopeClassification,
            rawResultCount: discovery.diagnostics.rawResultCount,
            eligibleResultCount:
              discovery.diagnostics.eligibleResultCount,
            filteringReasonCounts:
              discovery.diagnostics.filteringReasonCounts,
            databaseTimingStagesMs:
              discovery.diagnostics.databaseTimingStagesMs,
            writeStats: discovery.diagnostics.writeStats,
            coalesced: discovery.diagnostics.coalesced,
            usedMinimalFieldsFallback:
              discovery.diagnostics.usedMinimalFieldsFallback,
            outcome: discovery.diagnostics.outcome,
          },
        },
      },
      200,
    );
  } catch (error) {
    if (error instanceof MetaPageDiscoveryError) {
      return jsonResponse(
        {
          ok: false,
          message: error.message,
          category: error.category,
        },
        error.status,
      );
    }

    if (
      error instanceof Error &&
      /timed out|Nothing was partially saved/i.test(error.message)
    ) {
      return jsonResponse(
        {
          ok: false,
          message:
            "Facebook Page discovery timed out. Nothing changed on the connection — you can safely retry.",
          category: "temporary",
        },
        503,
      );
    }

    const category = facebookPageErrorCategory(error);

    const response = handleApiError(
      "facebook-pages-discover",
      error,
      "Facebook Pages could not be loaded.",
    );

    // Attach a safe category when the default error handler produced JSON.
    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as Record<
        string,
        unknown
      >;

      return jsonResponse(
        {
          ...body,
          category:
            typeof body.message === "string" &&
            /timed out/i.test(body.message)
              ? "temporary"
              : category,
        },
        response.status,
      );
    } catch {
      return response;
    }
  }
}
