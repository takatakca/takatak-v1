import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { hasValidWriteOrigin } from "@/lib/security/write-request";
import { isSmartLinkStatus, validateSmartLinkInput } from "@/lib/social/smartlinks/policy";
import { deleteSmartLink, setSmartLinkStatus, updateSmartLink } from "@/lib/social/smartlinks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

async function scope(request: NextRequest, context: Context) {
  if (!hasValidWriteOrigin(request)) {
    return { error: jsonResponse({ ok: false, message: "The request origin could not be verified." }, 403) } as const;
  }
  const { id } = await context.params;
  if (!UUID.test(id)) return { error: jsonResponse({ ok: false, message: "This SmartLink was not found." }, 404) } as const;
  const gate = await requireWorkspaceApiPermission("manage_social_accounts");
  if (!gate.ok) return { error: gate.response } as const;
  const brand = await resolveBrandSessionContextFromRequest(gate.access);
  if (!brand.activeBrandId) return { error: jsonResponse({ ok: false, message: "Choose a brand first." }, 400) } as const;
  return { id, clientId: gate.access.activeClientId, businessBrandId: brand.activeBrandId } as const;
}

/** Edit the page ({ slug, title, bio, buttons }) or publish / unpublish it ({ status }). */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const target = await scope(request, context);
    if ("error" in target) return target.error;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && "status" in body && Object.keys(body).length === 1) {
      if (!isSmartLinkStatus(body.status)) return jsonResponse({ ok: false, message: "Unknown status." }, 400);
      await setSmartLinkStatus({ ...target, status: body.status });
      return jsonResponse({ ok: true }, 200);
    }
    const validation = validateSmartLinkInput(body);
    if (!validation.ok) {
      return jsonResponse(
        { ok: false, message: validation.message, messageFr: validation.messageFr, fieldErrors: { [validation.field]: "invalid" } },
        400,
      );
    }
    await updateSmartLink({ ...target, value: validation.value });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("smartlinks-update", error, "The SmartLink could not be saved.");
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const target = await scope(request, context);
    if ("error" in target) return target.error;
    await deleteSmartLink(target);
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("smartlinks-delete", error, "The SmartLink could not be deleted.");
  }
}
