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
  connectLinkedThreadsAccount,
} from "@/lib/social/connections/social-threads-account-service";
import { toAccountPictureSrc } from "@/lib/social/media/remote-image";
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
        message:
          "The selected social connection identifier is invalid.",
      },
      400,
    );
  }

  try {
    const selection = await connectLinkedThreadsAccount({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/threads");
    revalidatePath("/dashboard/social/instagram");
    revalidatePath("/dashboard/social/facebook");

    return jsonResponse(
      {
        ok: true,
        message: selection.idempotent
          ? "This Threads account is already connected."
          : "Threads connected successfully.",
        selection: {
          connectionId: selection.connectionId,
          socialAccountId: selection.socialAccountId,
          displayName: selection.displayName,
          handle: selection.handle,
          profileImageUrl: toAccountPictureSrc(selection.socialAccountId),
          idempotent: selection.idempotent,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "threads-account-select",
      error,
      "The Threads account could not be connected.",
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
