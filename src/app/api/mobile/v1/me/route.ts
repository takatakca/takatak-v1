// Claude (Anthropic) · 2026-11-21 — native app: who is signed in, and which businesses they can open.
import type { NextRequest } from "next/server";

import { authenticateMobile } from "@/lib/mobile/mobile-auth";
import { jsonResponse } from "@/lib/security/api-response";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await authenticateMobile(request);
  if (!gate.ok) return gate.response;
  const { access, profileDetails, clientNames, user } = gate.context;

  const allowed =
    access.mode === "client_scoped" || access.mode === "selection_required"
      ? access.allowedClientIds
      : [];
  const workspaces = allowed.map((id) => ({ id, name: clientNames[id] ?? "Business" }));
  const scoped = access.mode === "client_scoped";

  return jsonResponse(
    {
      ok: true,
      user: {
        id: user.id,
        email: profileDetails?.email ?? user.email ?? null,
        firstName: profileDetails?.firstName ?? null,
        lastName: profileDetails?.lastName ?? null,
        displayName: profileDetails?.displayName ?? null,
      },
      mode: access.mode,
      platformAdmin: access.mode === "platform_admin",
      workspace: scoped
        ? { id: access.activeClientId, name: clientNames[access.activeClientId] ?? "Business", role: access.role }
        : null,
      workspaces,
      can: scoped
        ? {
            invoices: hasEffectivePermission(access, "manage_settings"),
            dashboard: hasEffectivePermission(access, "view_dashboard"),
            team: hasEffectivePermission(access, "view_team"),
          }
        : { invoices: false, dashboard: false, team: false },
    },
    200,
  );
}
