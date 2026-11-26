import { NextRequest } from "next/server";

import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import {
  addBlueskyCompetitor,
  listBlueskyCompetitors,
  removeBlueskyCompetitor,
} from "@/lib/social/providers/bluesky-competitors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) return jsonResponse({ ok: true, competitors: [] }, 200);
    const rows = await listBlueskyCompetitors({ clientId: gate.access.activeClientId, businessBrandId: brand.activeBrandId });
    const competitors = rows.map((row) => ({
      ref: row.ref,
      username: row.username,
      account: row.account
        ? { username: row.account.username, name: row.account.name, followers: row.account.followers, mediaCount: row.account.mediaCount, media: row.account.media }
        : null,
    }));
    return jsonResponse({ ok: true, competitors }, 200);
  } catch (error) {
    return handleApiError("bluesky-competitors-get", error, "Bluesky competitors could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) return jsonResponse({ ok: false, message: "Select a brand before adding a competitor." }, 400);
    const body = (await request.json().catch(() => ({}))) as { username?: unknown };
    await addBlueskyCompetitor({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      handle: typeof body.username === "string" ? body.username.slice(0, 260) : "",
    });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("bluesky-competitors-add", error, "That Bluesky account could not be added.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission("manage_social_accounts");
    if (!gate.ok) return gate.response;
    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) return jsonResponse({ ok: false, message: "Select a brand first." }, 400);
    const ref = request.nextUrl.searchParams.get("ref") ?? "";
    if (!/^bsc_[a-f0-9]{24}$/.test(ref)) return jsonResponse({ ok: false, message: "Choose a competitor to remove." }, 400);
    await removeBlueskyCompetitor({ clientId: gate.access.activeClientId, businessBrandId: brand.activeBrandId, ref });
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return handleApiError("bluesky-competitors-remove", error, "That competitor could not be removed.");
  }
}
