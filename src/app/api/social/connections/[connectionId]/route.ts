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
import { disconnectScopedSocialConnection } from "@/lib/social/connections/social-connection-lifecycle";
import { isSocialConnectionProvider } from "@/lib/social/providers/registry";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
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

  const providerParam =
    request.nextUrl.searchParams
      .get("provider")
      ?.trim() ?? "";

  const provider =
    providerParam &&
    isSocialConnectionProvider(providerParam)
      ? providerParam
      : undefined;

  if (providerParam && !provider) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected social provider is invalid.",
      },
      400,
    );
  }

  try {
    const connection =
      await disconnectScopedSocialConnection({
        clientId:
          gate.access.activeClientId,
        profileId: gate.access.profileId,
        connectionId,
        provider,
      });

    revalidatePath("/dashboard/social");
    revalidatePath(
      "/dashboard/social/accounts",
    );
    revalidatePath("/dashboard/activity");

    return jsonResponse(
      {
        ok: true,
        message:
          "The social provider was disconnected successfully.",
        connection: {
          id: connection.id,
          provider: connection.provider,
          status: connection.status,
          businessBrandId:
            connection.businessBrandId,
          disconnectedAt:
            connection.disconnectedAt,
        },
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
