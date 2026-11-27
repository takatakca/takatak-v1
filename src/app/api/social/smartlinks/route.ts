import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { validateSmartLinkInput } from "@/lib/social/smartlinks/policy";
import { createSmartLink, listSmartLinks } from "@/lib/social/smartlinks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SmartLinks of the active brand. Reading needs view_social; creating needs
// manage_social_accounts. Every row is scoped to the workspace and the brand.

export async function GET() {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) return jsonResponse({ ok: true, smartLinks: [] }, 200);
    const smartLinks = await listSmartLinks({ clientId: gate.access.activeClientId, businessBrandId: brand.activeBrandId });
    return jsonResponse({ ok: true, smartLinks }, 200);
  } catch (error) {
    return handleApiError("smartlinks-list", error, "SmartLinks could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasValidWriteOrigin(request)) {
      return jsonResponse({ ok: false, message: "The request origin could not be verified." }, 403);
    }
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) return jsonResponse({ ok: false, message: "Choose a brand first." }, 400);
    const body = await request.json().catch(() => null);
    const validation = validateSmartLinkInput(body);
    if (!validation.ok) {
      return jsonResponse(
        { ok: false, message: validation.message, messageFr: validation.messageFr, fieldErrors: { [validation.field]: "invalid" } },
        400,
      );
    }
    const created = await createSmartLink({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      profileId: gate.access.profileId,
      value: validation.value,
    });
    return jsonResponse({ ok: true, id: created.id }, 201);
  } catch (error) {
    return handleApiError("smartlinks-create", error, "The SmartLink could not be created.");
  }
}
