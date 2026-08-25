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
import { continueSocialAuthorization } from "@/lib/social/connections/social-connection-lifecycle";
import { isSocialConnectionProvider } from "@/lib/social/providers/registry";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

  let returnPath: string | undefined;

  try {
    const body = (await request.json()) as {
      returnPath?: unknown;
    };

    if (
      typeof body.returnPath === "string" &&
      body.returnPath.startsWith("/dashboard")
    ) {
      returnPath = body.returnPath;
    }
  } catch {
    // Body is optional for Continue.
  }

  try {
    const authorization =
      await continueSocialAuthorization({
        clientId: gate.access.activeClientId,
        profileId: gate.access.profileId,
        connectionId,
        provider,
        returnPath,
      });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/accounts");

    return jsonResponse(
      {
        ok: true,
        message:
          authorization.mode === "resume"
            ? "Continue to Facebook to finish this authorization."
            : "A fresh authorization request was prepared. Continue to Facebook.",
        authorization: {
          authorizationUrl:
            authorization.authorizationUrl,
          expiresAt: authorization.expiresAt,
          provider: authorization.provider,
          connectionId: authorization.connectionId,
          mode: authorization.mode,
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-connections-continue",
      error,
      "The pending authorization could not be continued.",
    );
  }
}
