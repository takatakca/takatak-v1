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
import { disconnectSocialConnection } from "@/lib/social/connections/social-connection-management";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{
      connectionId: string;
    }>;
  },
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "manage_social_accounts",
    );

  if (!gate.ok) {
    return gate.response;
  }

  const { connectionId } =
    await context.params;

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
    const connection =
      await disconnectSocialConnection({
        clientId:
          gate.access.activeClientId,

        profileId:
          gate.access.profileId,

        connectionId,
      });

    revalidatePath(
      "/dashboard/social",
    );

    revalidatePath(
      "/dashboard/social/accounts",
    );

    revalidatePath(
      "/dashboard/activity",
    );

    return jsonResponse(
      {
        ok: true,

        message:
          "The social provider was disconnected successfully.",

        connection,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-connections-disconnect",
      error,
      "The social provider could not be disconnected.",
    );
  }
}
