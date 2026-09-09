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
import { readJsonBody } from "@/lib/security/write-request";
import { createSocialOAuthState } from "@/lib/social/connections/social-connection-service";
import { validateCreateSocialOAuthState } from "@/lib/social/connections/social-connection-validation";

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
        message:
          bodyResult.message,
      },
      bodyResult.status,
    );
  }

  // Subscription / paid access is decided only in assertClientCanConnectSocial
  // (ClientSubscription + trusted server env). Browser preview helpers and any
  // client-supplied bypass fields are never authorization inputs.
  const validation =
    validateCreateSocialOAuthState(
      bodyResult.body,
    );

  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message:
          validation.message,
        fieldErrors:
          validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const authorization =
      await createSocialOAuthState({
        clientId:
          gate.access.activeClientId,

        profileId:
          gate.access.profileId,

        businessBrandId:
          validation.data
            .businessBrandId,

        provider:
          validation.data.provider,

        returnPath:
          validation.data.returnPath,
      });

    revalidatePath(
      "/dashboard/social",
    );

    revalidatePath(
      "/dashboard/social/accounts",
    );

    // Established browser flow: return the Meta destination URL only.
    // Raw OAuth state / PKCE verifier material is never included here.
    return jsonResponse(
      {
        ok: true,

        message:
          authorization.provider === "instagram"
            ? "Continue to Instagram to authorize this brand."
            : authorization.provider === "threads"
              ? "Continue to Threads to authorize this brand."
              : authorization.provider === "tiktok"
                ? "Continue to TikTok to authorize this brand."
                : authorization.provider === "google"
                  ? "Continue to Google to authorize YouTube for this brand."
                  : authorization.provider === "x"
                    ? "Continue to X to authorize this brand."
                    : "Continue to Facebook to authorize this brand.",

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
      "social-connections-start",
      error,
      "The social authorization request could not be started.",
    );
  }
}
