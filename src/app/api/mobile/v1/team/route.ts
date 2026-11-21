// Claude (Anthropic) · 2026-11-21 — native app round 2: the business's team, read only (same loader and
// permission as /dashboard/team). Inviting and changing roles stay on the website for now.
import type { NextRequest } from "next/server";

import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { getWorkspaceTeamData } from "@/lib/team/team-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "view_team");
  if (!gate.ok) return gate.response;
  try {
    const data = await getWorkspaceTeamData(gate.context.access);
    if (data.source !== "database") return jsonResponse({ ok: true, available: false, members: [], pendingInvitations: 0 }, 200);
    return jsonResponse(
      {
        ok: true,
        available: true,
        members: data.members.map((m) => ({
          id: m.membershipId, name: m.displayName, email: m.email, role: m.customRoleName ?? m.role,
          status: m.status, joinedAt: m.joinedAt, me: m.profileId === gate.context.access.profileId,
        })),
        pendingInvitations: data.invitations.filter((i) => i.status === "pending").length,
      },
      200,
    );
  } catch (error) {
    return handleApiError("mobile-team", error, "The team could not be loaded.");
  }
}
