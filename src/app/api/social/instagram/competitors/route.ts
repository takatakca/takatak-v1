import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalInstagramDashboard } from "@/lib/social/connections/instagram-dashboard-resolve";
import {
  addInstagramCompetitor,
  listInstagramCompetitors,
  removeInstagramCompetitor,
} from "@/lib/social/providers/instagram-competitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveAccount(clientId: string, businessBrandId: string | null) {
  if (!businessBrandId) return null;
  const resolved = await resolveCanonicalInstagramDashboard({ clientId, businessBrandId });
  return resolved.kind === "ready" ? { businessBrandId, socialAccountId: resolved.socialAccountId } : null;
}

export async function GET() {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    const account = await resolveAccount(gate.access.activeClientId, brand.activeBrandId);
    if (!account) return jsonResponse({ ok: true, competitors: [] }, 200);
    const rows = await listInstagramCompetitors({ clientId: gate.access.activeClientId, ...account });
    // Instagram's numeric ids stay on the server; the screen gets the public numbers only.
    const competitors = rows.map((row) => ({
      ref: row.ref,
      username: row.username,
      account: row.account
        ? {
            username: row.account.username,
            name: row.account.name,
            followers: row.account.followers,
            mediaCount: row.account.mediaCount,
            media: row.account.media,
          }
        : null,
    }));
    return jsonResponse({ ok: true, competitors }, 200);
  } catch (error) {
    return handleApiError("instagram-competitors-get", error, "Instagram competitors could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    const account = await resolveAccount(gate.access.activeClientId, brand.activeBrandId);
    if (!account) return jsonResponse({ ok: false, message: "Connect an Instagram account first." }, 400);
    const body = (await request.json().catch(() => ({}))) as { username?: unknown };
    await addInstagramCompetitor({
      clientId: gate.access.activeClientId,
      ...account,
      username: typeof body.username === "string" ? body.username.slice(0, 120) : "",
    });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("instagram-competitors-add", error, "That Instagram account could not be added.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) return jsonResponse({ ok: false, message: "Select a brand first." }, 400);
    const ref = request.nextUrl.searchParams.get("ref") ?? "";
    if (!/^igc_[a-f0-9]{24}$/.test(ref)) return jsonResponse({ ok: false, message: "Choose a competitor to remove." }, 400);
    await removeInstagramCompetitor({ clientId: gate.access.activeClientId, businessBrandId: brand.activeBrandId, ref });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("instagram-competitors-remove", error, "That competitor could not be removed.");
  }
}
