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
  clearSelectedThreadsAccount,
  startLinkedThreadsAuthorization,
} from "@/lib/social/connections/social-threads-account-service";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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
        message: "The selected social connection identifier is invalid.",
      },
      400,
    );
  }

  try {
    // Threads linked to Facebook: check the Page + Instagram prerequisites,
    // then start the real Threads authorization with a stored OAuth state.
    // (A raw connection id as `state` is rejected by the Threads callback.)
    const authorization = await startLinkedThreadsAuthorization({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
      returnPath: "/dashboard/social?connections=open&platform=threads",
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");

    return jsonResponse(
      {
        ok: true,
        message: "Continue to Threads to authorize this brand.",
        authorization: {
          authorizationUrl: authorization.authorizationUrl,
          expiresAt: authorization.expiresAt,
          provider: authorization.provider,
          connectionId: authorization.connectionId,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "threads-account-start",
      error,
      "Threads authorization could not be started.",
    );
  }
}

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
    const cleared = await clearSelectedThreadsAccount({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/threads");

    return jsonResponse(
      {
        ok: true,
        message:
          "Threads disconnected. Facebook Page remains connected.",
        selection: {
          connectionId: cleared.connectionId,
          socialAccountId: cleared.socialAccountId,
          displayName: cleared.displayName,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "threads-account-clear",
      error,
      "The Threads account could not be removed.",
    );
  }
}
