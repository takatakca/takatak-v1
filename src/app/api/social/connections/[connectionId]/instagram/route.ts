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
  clearSelectedInstagramAccount,
  connectLinkedInstagramAccount,
  instagramErrorCategory,
} from "@/lib/social/connections/social-instagram-account-service";
import { MetaInstagramError } from "@/lib/social/providers/meta-instagram";
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
    const selection = await connectLinkedInstagramAccount({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/instagram");
    revalidatePath("/dashboard/social/threads");
    revalidatePath("/dashboard/social/facebook");

    return jsonResponse(
      {
        ok: true,
        message: selection.idempotent
          ? "This Instagram account is already connected."
          : "Instagram connected successfully.",
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
    if (error instanceof MetaInstagramError) {
      return jsonResponse(
        {
          ok: false,
          message: error.message,
          category: error.category,
        },
        error.status,
      );
    }

    const category = instagramErrorCategory(error);
    const response = handleApiError(
      "instagram-account-select",
      error,
      "The Instagram account could not be connected.",
    );

    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as Record<string, unknown>;
      return jsonResponse({ ...body, category }, response.status);
    } catch {
      return response;
    }
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
    const cleared = await clearSelectedInstagramAccount({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/instagram");
    revalidatePath("/dashboard/social/threads");

    return jsonResponse(
      {
        ok: true,
        message:
          "Instagram disconnected. Facebook Page remains connected.",
        selection: {
          connectionId: cleared.connectionId,
          socialAccountId: cleared.socialAccountId,
          displayName: cleared.displayName,
        },
      },
      200,
    );
  } catch (error) {
    if (error instanceof MetaInstagramError) {
      return jsonResponse(
        {
          ok: false,
          message: error.message,
          category: error.category,
        },
        error.status,
      );
    }

    const category = instagramErrorCategory(error);
    const response = handleApiError(
      "instagram-account-clear",
      error,
      "The Instagram account could not be removed.",
    );

    try {
      const cloned = response.clone();
      const body = (await cloned.json()) as Record<string, unknown>;
      return jsonResponse({ ...body, category }, response.status);
    } catch {
      return response;
    }
  }
}
