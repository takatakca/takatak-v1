import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { startInstagramPublishingAuthorization } from "@/lib/social/connections/social-connection-service";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RETURN_PATH = "/dashboard/social/accounts";

function readReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/dashboard")) return DEFAULT_RETURN_PATH;
  if (value.startsWith("//") || value.includes("\\") || value.includes("://")) return DEFAULT_RETURN_PATH;
  return value.slice(0, 512);
}

/**
 * POST — "Grant publishing" for one connected Instagram Login connection.
 * Starts an incremental authorization that adds
 * `instagram_business_content_publish` to the scopes already granted. The
 * connection and its selected professional account are preserved; the
 * response carries the Instagram redirect URL only, never state or tokens.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_social_accounts");
  if (!gate.ok) return gate.response;

  const { connectionId } = await context.params;
  if (!isUuid(connectionId)) {
    return jsonResponse({ ok: false, message: "The selected social connection identifier is invalid." }, 400);
  }

  let returnPath = DEFAULT_RETURN_PATH;
  try {
    const body = (await request.json()) as { returnPath?: unknown };
    returnPath = readReturnPath(body?.returnPath);
  } catch {
    // Optional body.
  }

  try {
    const authorization = await startInstagramPublishingAuthorization({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      connectionId,
      returnPath,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");
    revalidatePath("/dashboard/social/instagram");

    return jsonResponse(
      {
        ok: true,
        message: "Continue to Instagram and allow publishing for this account.",
        authorization: {
          authorizationUrl: authorization.authorizationUrl,
          expiresAt: authorization.expiresAt,
          provider: authorization.provider,
          mode: authorization.mode,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "instagram-publishing-grant",
      error,
      "Instagram publishing access could not be requested.",
    );
  }
}
