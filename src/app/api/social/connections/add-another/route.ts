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
import { addAnotherSocialAccount } from "@/lib/social/connections/social-connection-lifecycle";
import { isSocialConnectionProvider } from "@/lib/social/providers/registry";
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        message:
          "The add-another-account request is invalid.",
      },
      400,
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The add-another-account request is invalid.",
      },
      400,
    );
  }

  const record = body as Record<string, unknown>;
  const sourceConnectionId =
    typeof record.sourceConnectionId === "string"
      ? record.sourceConnectionId.trim()
      : "";
  const providerParam =
    typeof record.provider === "string"
      ? record.provider.trim()
      : "";
  const returnPath =
    typeof record.returnPath === "string" &&
    record.returnPath.startsWith("/dashboard")
      ? record.returnPath
      : "/dashboard/social?connections=open";

  if (!isUuid(sourceConnectionId)) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected social connection identifier is invalid.",
      },
      400,
    );
  }

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
    const authorization =
      await addAnotherSocialAccount({
        clientId: gate.access.activeClientId,
        profileId: gate.access.profileId,
        sourceConnectionId,
        provider,
        returnPath,
      });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");

    return jsonResponse(
      {
        ok: true,
        message:
          "Continue to Facebook to authorize another account. Your existing connection was not changed.",
        authorization: {
          authorizationUrl:
            authorization.authorizationUrl,
          expiresAt: authorization.expiresAt,
          provider: authorization.provider,
          connectionId: authorization.connectionId,
          mode: authorization.mode,
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(
      "social-connections-add-another",
      error,
      "Another account authorization could not be started.",
    );
  }
}
