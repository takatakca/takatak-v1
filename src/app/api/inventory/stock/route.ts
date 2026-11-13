import type { NextRequest } from "next/server";
import { adjustInventoryStock } from "@/lib/db/inventory";
import { movementInput } from "@/lib/inventory/validation";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_inventory");
  if (!gate.ok) return gate.response;
  const body = await readJsonBody(request);
  if (!body.ok)
    return jsonResponse({ ok: false, message: body.message }, body.status);
  try {
    const movement = await adjustInventoryStock(
      gate.access.activeClientId,
      gate.access.profileId,
      movementInput(body.body),
    );
    return jsonResponse({ ok: true, movement }, 201);
  } catch (error) {
    return handleApiError(
      "inventory-stock",
      error,
      "Stock could not be updated.",
    );
  }
}
