import {
  NextRequest,
  NextResponse,
} from "next/server";
import { revalidatePath } from "next/cache";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { createBlueskyOAuthState } from "@/lib/social/connections/bluesky-oauth-start";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "manage_social_accounts",
    );

  if (!gate.ok) {
    return gate.response;
  }

  const bodyResult =
    await readJsonBody(request);

  if (!bodyResult.ok) {
    return jsonResponse(
      {
        ok: false,
        message: bodyResult.message,
      },
      bodyResult.status,
    );
  }

  if (
    typeof bodyResult.body !== "object" ||
    bodyResult.body === null ||
    Array.isArray(bodyResult.body)
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The Bluesky connection request is invalid.",
      },
      400,
    );
  }

  const body =
    bodyResult.body as Record<string, unknown>;

  const businessBrandId =
    typeof body.businessBrandId === "string"
      ? body.businessBrandId.trim()
      : "";

  if (!isUuid(businessBrandId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "Select a valid brand before connecting Bluesky.",
        fieldErrors: {
          businessBrandId:
            "Select a valid brand.",
        },
      },
      400,
    );
  }

  try {
    const authorization =
      await createBlueskyOAuthState({
        clientId:
          gate.access.activeClientId,
        profileId:
          gate.access.profileId,
        businessBrandId,
        identifier: body.identifier,
        returnPath: body.returnPath,
      });

    revalidatePath(
      "/dashboard/social",
    );
    revalidatePath(
      "/dashboard/social/accounts",
    );

    return jsonResponse(
      {
        ok: true,
        message:
          "Continue to Bluesky to authorize this brand.",
        authorization: {
          authorizationUrl:
            authorization.authorizationUrl,
          expiresAt:
            authorization.expiresAt,
          provider:
            authorization.provider,
          connectionId:
            authorization.connectionId,
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(
      "bluesky-connections-start",
      error,
      "The Bluesky authorization request could not be started.",
    );
  }
}
