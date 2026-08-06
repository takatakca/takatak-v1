import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { getSocialConnectionsData } from "@/lib/social/connections/social-connection-data";
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

  try {
    const connections =
      await getSocialConnectionsData(
        gate.access.activeClientId,
        requestedBrandId || null,
      );

    return jsonResponse(
      {
        ok: true,
        connections,
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
