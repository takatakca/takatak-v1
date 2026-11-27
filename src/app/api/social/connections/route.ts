import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { loadBrandRestriction } from "@/lib/security/member-brand-access";
import { isBrandAllowed } from "@/lib/security/brand-access-policy";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { getSocialConnectionsData } from "@/lib/social/connections/social-connection-data";
import { toAccountPictureSrc, toClientSocialImageUrl } from "@/lib/social/media/remote-image";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
): Promise<NextResponse> {
  const gate =
    await requireWorkspaceApiPermission(
      "view_social",
    );

  if (!gate.ok) {
    return gate.response;
  }

  const requestedBrandId =
    request.nextUrl.searchParams
      .get("brandId")
      ?.trim() ?? "";

  if (
    requestedBrandId &&
    !isUuid(requestedBrandId)
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          "The selected brand identifier is invalid.",
      },
      400,
    );
  }

  // A member limited to some brands only sees those brands' connections.
  const restriction = await loadBrandRestriction(gate.access);
  if (requestedBrandId && !isBrandAllowed(restriction, requestedBrandId)) {
    return jsonResponse({ ok: false, message: "This brand was not found." }, 404);
  }

  try {
    const connections = (
      await getSocialConnectionsData(
        gate.access.activeClientId,
        requestedBrandId || null,
      )
    ).filter((connection) => isBrandAllowed(restriction, connection.brandId));

    return jsonResponse(
      {
        ok: true,
        connections: connections.map((connection) => ({
          ...connection,
          accounts: connection.accounts.map((account) => ({
            ...account,
            profileImageUrl:
              account.platform === "facebook" ||
              account.platform === "instagram" ||
              account.platform === "threads"
                ? toAccountPictureSrc(account.id)
                : toClientSocialImageUrl(account.profileImageUrl),
          })),
        })),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "social-connections-list",
      error,
      "The social connections could not be loaded.",
    );
  }
}
