import { revalidatePath } from "next/cache";
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
  clearSelectedFacebookPage,
  facebookPageErrorCategory,
  selectFacebookPage,
} from "@/lib/social/connections/social-facebook-page-service";
import { MetaPageDiscoveryError } from "@/lib/social/providers/meta-pages";
import { toAccountPictureSrc } from "@/lib/social/media/remote-image";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
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

  let socialAccountId = "";

  try {
    const body = (await request.json()) as {
      socialAccountId?: unknown;
    };

    if (
      typeof body.socialAccountId === "string" &&
      isUuid(body.socialAccountId)
    ) {
      socialAccountId = body.socialAccountId;
    }
  } catch {
    // Handled below.
  }

  if (!socialAccountId) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Select a Facebook Page to continue setup.",
        category: "malformed",
      },
      400,
    );
  }

  try {
    const selection = await selectFacebookPage({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
      socialAccountId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/facebook");
    revalidatePath("/dashboard/social/instagram");

    return jsonResponse(
      {
        ok: true,
        message: selection.idempotent
          ? "This Facebook Page is already connected."
          : "Facebook Page connected successfully.",
        selection: {
          connectionId: selection.connectionId,
          connectionStatus: selection.connectionStatus,
          socialAccountId: selection.socialAccountId,
          assignmentId: selection.assignmentId,
          // Facebook Page ID omitted from client response; stored server-side only.
          pageName: selection.pageName,
          profileImageUrl: toAccountPictureSrc(selection.socialAccountId),
          idempotent: selection.idempotent,
          capabilityClass: selection.capabilityClass,
          connectionEligible: selection.connectionEligible,
          fullyManageable: selection.fullyManageable,
          canReadEngagement: selection.canReadEngagement,
          canPublish: selection.canPublish,
          canModerate: selection.canModerate,
          limitationLabel: selection.limitationLabel,
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

    const category = facebookPageErrorCategory(error);

    const response = handleApiError(
      "facebook-pages-select",
      error,
      "The Facebook Page could not be selected.",
    );

    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as Record<
        string,
        unknown
      >;

      return jsonResponse(
        {
          ...body,
          category,
        },
        response.status,
      );
    } catch {
      return response;
    }
  }
}

/**
 * Clear the selected Facebook Page so the user can pick another.
 * Keeps Meta user authorization (connection returns to authorized).
 */
export async function DELETE(
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
    const cleared = await clearSelectedFacebookPage({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/facebook");
    revalidatePath("/dashboard/social/instagram");

    return jsonResponse(
      {
        ok: true,
        message:
          "Facebook Page removed. Select another Page to finish setup.",
        selection: {
          connectionId: cleared.connectionId,
          connectionStatus: cleared.connectionStatus,
          socialAccountId: cleared.socialAccountId,
          pageName: cleared.pageName,
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

    const category = facebookPageErrorCategory(error);

    const response = handleApiError(
      "facebook-pages-clear",
      error,
      "The Facebook Page could not be removed.",
    );

    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as Record<
        string,
        unknown
      >;

      return jsonResponse(
        {
          ...body,
          category,
        },
        response.status,
      );
    } catch {
      return response;
    }
  }
}
