import { NextRequest, NextResponse } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { getSocialConnectionsData } from "@/lib/social/connections/social-connection-data";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — the capability profile of one connection of the active workspace:
 * token health, granted/missing scopes, and what TAKATAK can do with it today.
 * Shared by Studio, agents and the Social Manager; never returns tokens.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ connectionId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_social");
  if (!gate.ok) return gate.response;
  const { connectionId } = await context.params;
  if (!isUuid(connectionId)) {
    return jsonResponse({ ok: false, message: "The selected social connection identifier is invalid." }, 400);
  }
  try {
    const connections = await getSocialConnectionsData(gate.access.activeClientId);
    const connection = connections.find((item) => item.id === connectionId);
    if (!connection) return jsonResponse({ ok: false, message: "Connection not found." }, 404);
    return jsonResponse(
      {
        ok: true,
        connection: {
          id: connection.id,
          provider: connection.provider,
          status: connection.status,
          brandId: connection.brandId,
          scopes: connection.scopes,
        },
        capabilities: connection.capabilities,
      },
      200,
    );
  } catch (error) {
    return handleApiError("social-connection-capabilities", error, "The connection capabilities could not be loaded.");
  }
}
