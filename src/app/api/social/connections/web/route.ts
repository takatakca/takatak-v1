import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import {
  getWebSiteConnection,
  startWebSiteConnection,
} from "@/lib/social/connections/web-site-connection";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readBrandId(value: unknown): string | null {
  return typeof value === "string" && isUuid(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_social_accounts");
  if (!gate.ok) return gate.response;

  const businessBrandId = readBrandId(
    request.nextUrl.searchParams.get("businessBrandId"),
  );
  if (!businessBrandId) {
    return jsonResponse(
      { ok: false, message: "Select a valid brand." },
      400,
    );
  }

  try {
    const connection = await getWebSiteConnection({
      clientId: gate.access.activeClientId,
      businessBrandId,
    });

    return jsonResponse({ ok: true, connection }, 200);
  } catch (error) {
    return handleApiError(
      "web-site-connection",
      error,
      "The website connection could not be loaded.",
    );
  }
}

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

  const body = asRecord(bodyResult.body);
  const businessBrandId = readBrandId(body?.businessBrandId);
  const siteUrl = typeof body?.siteUrl === "string" ? body.siteUrl : "";

  if (!businessBrandId) {
    return jsonResponse(
      {
        ok: false,
        message: "Select a valid brand.",
        fieldErrors: { businessBrandId: "Select a valid brand." },
      },
      400,
    );
  }

  try {
    const connection = await startWebSiteConnection({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      businessBrandId,
      siteUrl,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/web");

    return jsonResponse(
      {
        ok: true,
        message: "Add the verification tag to the homepage, then verify.",
        connection,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "web-site-connection-start",
      error,
      "Website verification could not be started.",
    );
  }
}
