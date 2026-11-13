import type { NextRequest } from "next/server";
import { getInventoryLabel, saveInventoryLabel } from "@/lib/db/inventory";
import { labelConfigInput } from "@/lib/inventory/label-config";
import { uuid } from "@/lib/inventory/validation";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_inventory");
  if (!gate.ok) return gate.response;
  const body = await readJsonBody(request, 600_000);
  if (!body.ok)
    return jsonResponse({ ok: false, message: body.message }, body.status);
  try {
    const data = body.body as { productId?: unknown; config?: unknown } | null;
    const id = uuid(data?.productId);
    const config = labelConfigInput(data?.config);
    await saveInventoryLabel(
      gate.access.activeClientId,
      gate.access.profileId,
      id,
      config,
    );
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError(
      "inventory-label-save",
      error,
      "The label layout could not be saved.",
    );
  }
}

export async function GET(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("view_inventory");
  if (!gate.ok) return gate.response;
  try {
    const id = uuid(request.nextUrl.searchParams.get("product"));
    return jsonResponse(
      {
        ok: true,
        product: await getInventoryLabel(gate.access.activeClientId, id),
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "inventory-label-load",
      error,
      "The product label could not be loaded.",
    );
  }
}
