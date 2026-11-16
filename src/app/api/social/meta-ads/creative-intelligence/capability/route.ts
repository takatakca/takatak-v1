import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { isCreativeIntelligenceEnabledForClient } from "@/lib/social/analytics/creative-intelligence-rollout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Runtime-only feature availability for an authorized workspace member.
 * Read-only, no Meta calls, no client identifiers or credentials in response.
 * This avoids a build-time NEXT_PUBLIC flag that cannot change on a deployed image.
 */
export async function GET() {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;
    if (!isCreativeIntelligenceEnabledForClient(gate.access.activeClientId)) {
      return jsonResponse({ ok: true, enabled: false }, 200);
    }
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    return jsonResponse({ ok: true, enabled: Boolean(brand.activeBrandId) }, 200);
  } catch (error) {
    return handleApiError("meta-ads-creative-intelligence-capability", error, "Creative Intelligence availability cannot be verified.");
  }
}
