import type { NextRequest } from "next/server";
import { inventoryDirectory, saveInventoryProduct } from "@/lib/db/inventory";
import { productInput, uuid } from "@/lib/inventory/validation";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const gate = await requireWorkspaceApiPermission("view_inventory");
  if (!gate.ok) return gate.response;
  try {
    return jsonResponse(
      { ok: true, ...(await inventoryDirectory(gate.access.activeClientId)) },
      200,
    );
  } catch (error) {
    return handleApiError(
      "inventory-list",
      error,
      "Inventory is unavailable. The database migration may not be installed yet.",
    );
  }
}
async function write(request: NextRequest, editing: boolean) {
  const gate = await requireWorkspaceApiPermission("manage_inventory");
  if (!gate.ok) return gate.response;
  const body = await readJsonBody(request);
  if (!body.ok)
    return jsonResponse({ ok: false, message: body.message }, body.status);
  try {
    const input = productInput(body.body);
    const id = editing
      ? uuid((body.body as Record<string, unknown>).id)
      : undefined;
    const product = await saveInventoryProduct(
      gate.access.activeClientId,
      gate.access.profileId,
      input,
      id,
    );
    return jsonResponse({ ok: true, product }, editing ? 200 : 201);
  } catch (error) {
    return handleApiError(
      "inventory-save",
      error,
      "Product could not be saved.",
    );
  }
}
export async function POST(request: NextRequest) {
  return write(request, false);
}
export async function PATCH(request: NextRequest) {
  return write(request, true);
}
