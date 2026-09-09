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
  listStoredYoutubeChannels,
  selectYoutubeChannel,
} from "@/lib/social/connections/social-youtube-account-service";
import { toClientSocialImageUrl } from "@/lib/social/media/remote-image";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function revalidateYoutubePaths() {
  revalidatePath("/dashboard/social");
  revalidatePath("/dashboard/social/accounts");
  revalidatePath("/dashboard/social/youtube");
}

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ connectionId: string }>;
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

  try {
    const channels = await listStoredYoutubeChannels({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
    });

    return jsonResponse(
      {
        ok: true,
        message:
          channels.length === 0
            ? "No YouTube channels were found for this Google account."
            : "YouTube channels were loaded for selection.",
        channels: channels.map((channel) => ({
          socialAccountId: channel.socialAccountId,
          name: channel.displayName,
          handle: channel.handle,
          profileImageUrl: toClientSocialImageUrl(channel.profileImageUrl),
          selected: channel.selected,
        })),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-youtube-channels-list",
      error,
      "YouTube channels could not be loaded.",
    );
  }
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ connectionId: string }>;
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
    const body = (await request.json()) as { socialAccountId?: unknown };
    if (typeof body.socialAccountId === "string" && isUuid(body.socialAccountId)) {
      socialAccountId = body.socialAccountId;
    }
  } catch {
    // Handled below.
  }

  if (!socialAccountId) {
    return jsonResponse(
      {
        ok: false,
        message: "Select a YouTube channel to continue setup.",
      },
      400,
    );
  }

  try {
    const selection = await selectYoutubeChannel({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
      socialAccountId,
    });

    revalidateYoutubePaths();

    return jsonResponse(
      {
        ok: true,
        message: selection.idempotent
          ? "This YouTube channel is already connected."
          : "YouTube connected successfully.",
        selection: {
          connectionId: selection.connectionId,
          socialAccountId: selection.socialAccountId,
          displayName: selection.displayName,
          handle: selection.handle,
          profileImageUrl: toClientSocialImageUrl(selection.profileImageUrl),
          idempotent: selection.idempotent,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-youtube-channel-select",
      error,
      "The YouTube channel could not be selected.",
    );
  }
}
