import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { verifyWebSiteConnection } from "@/lib/social/connections/web-site-connection";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_social_accounts");
  if (!gate.ok) return gate.response;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const body =
    bodyResult.body &&
    typeof bodyResult.body === "object" &&
    !Array.isArray(bodyResult.body)
      ? (bodyResult.body as Record<string, unknown>)
      : null;
  const businessBrandId =
    typeof body?.businessBrandId === "string" && isUuid(body.businessBrandId)
      ? body.businessBrandId
      : null;

  if (!businessBrandId) {
    return jsonResponse(
      { ok: false, message: "Select a valid brand." },
      400,
    );
  }

  try {
    const connection = await verifyWebSiteConnection({
      clientId: gate.access.activeClientId,
      businessBrandId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/web");

    return jsonResponse(
      {
        ok: true,
        message: `${connection.host} is connected.`,
        connection,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "web-site-connection-verify",
      error,
      "The website could not be verified.",
    );
  }
}
