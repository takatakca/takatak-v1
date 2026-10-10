import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import {
  getBlogConnection,
  startBlogConnection,
} from "@/lib/social/connections/blog-connection";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readBrandId(value: unknown): string | null {
  return typeof value === "string" && isUuid(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("manage_social_accounts");
  if (!gate.ok) return gate.response;

  const businessBrandId = readBrandId(
    request.nextUrl.searchParams.get("businessBrandId"),
  );
  if (!businessBrandId) {
    return jsonResponse({ ok: false, message: "Select a valid brand." }, 400);
  }

  try {
    const state = await getBlogConnection({
      clientId: gate.access.activeClientId,
      businessBrandId,
    });
    return jsonResponse({ ok: true, ...state }, 200);
  } catch (error) {
    return handleApiError(
      "blog-connection",
      error,
      "The blog connection could not be loaded.",
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

  const businessBrandId = readBrandId(asRecord(bodyResult.body)?.businessBrandId);
  if (!businessBrandId) {
    return jsonResponse({ ok: false, message: "Select a valid brand." }, 400);
  }

  try {
    const connection = await startBlogConnection({
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      businessBrandId,
    });

    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/social/blog");
    revalidatePath("/blog");
    revalidatePath(connection.blogPath);

    return jsonResponse(
      {
        ok: true,
        message: `The TAKATAK blog page for ${connection.host} is ready.`,
        connection,
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "blog-connection-start",
      error,
      "The blog page could not be created.",
    );
  }
}
