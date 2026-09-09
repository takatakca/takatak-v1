import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

import { applySocialBrandAllowance } from "@/lib/billing/social/brand-allowance";
import { isUuid } from "@/lib/validation/common";
import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseKeepBrandIds(body: unknown): string[] | null | "invalid" {
  if (!body || typeof body !== "object" || !("brandIds" in body)) {
    return null;
  }

  const value = (body as { brandIds?: unknown }).brandIds;
  if (!Array.isArray(value)) {
    return "invalid";
  }

  if (!value.every((id) => typeof id === "string" && isUuid(id))) {
    return "invalid";
  }

  return value;
}

export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_settings");

  if (!gate.ok) {
    return gate.response;
  }

  const bodyResult = await readJsonBody(request);

  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const brandIds = parseKeepBrandIds(bodyResult.body);

  if (brandIds === "invalid") {
    return jsonResponse(
      { ok: false, message: "Select which brands to keep." },
      400,
    );
  }

  try {
    const result = await applySocialBrandAllowance({
      clientId: gate.access.activeClientId,
      actorProfileId: gate.access.profileId,
      keepBrandIds: brandIds,
    });

    revalidatePath("/dashboard/social/settings");
    revalidatePath("/dashboard/brands");
    revalidatePath("/dashboard/billing");

    return jsonResponse({
      ok: true,
      message:
        result.frozenIds.length > 0
          ? "Extra brands were frozen. They were not deleted."
          : result.restoredIds.length > 0
            ? "Frozen brands were restored up to this plan's allowance."
            : "Brand allowance is already within this plan.",
      frozenCount: result.frozenIds.length,
      restoredCount: result.restoredIds.length,
      blockedPostCount: result.blockedPostIds.length,
    }, 200);
  } catch (error) {
    return handleApiError(
      "billing-brand-allowance",
      error,
      "Brand allowance could not be updated.",
    );
  }
}
