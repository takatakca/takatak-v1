import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { selectLookerStudioReport } from "@/lib/social/connections/looker-studio-account-service";
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
  const gate = await requireWorkspaceApiPermission("manage_social_accounts");

  if (!gate.ok) {
    return gate.response;
  }

  const { connectionId } = await context.params;

  if (!isUuid(connectionId)) {
    return jsonResponse(
      {
        ok: false,
        message: "The selected social connection identifier is invalid.",
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
    socialAccountId = "";
  }

  if (!socialAccountId) {
    return jsonResponse(
      {
        ok: false,
        message: "Choose a Looker Studio report to continue.",
      },
      400,
    );
  }

  try {
    const selected = await selectLookerStudioReport({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
      socialAccountId,
    });

    const { invalidateBrandSelectorCache } = await import(
      "@/lib/security/brand-context"
    );
    invalidateBrandSelectorCache(gate.access.activeClientId);

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/looker_studio");
    revalidatePath("/dashboard/social/brands/settings");
    revalidatePath("/dashboard/social/reports");

    return jsonResponse(
      {
        ok: true,
        message: "Looker Studio report connected.",
        selection: {
          displayName: selected.displayName,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-looker-studio-select",
      error,
      "The Looker Studio report could not be connected.",
    );
  }
}
