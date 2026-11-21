// Claude (Anthropic) · 2026-11-21 — native app round 2: the business's leads (same loader, scope and
// permission as /dashboard/leads). Client-scoped only, so it never falls back to demo data.
import type { NextRequest } from "next/server";

import { getLeadsOverviewData } from "@/lib/leads/leads-data";
import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { MOBILE_LIST_LIMIT } from "@/lib/mobile/mobile-session";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "view_dashboard");
  if (!gate.ok) return gate.response;
  try {
    const data = await getLeadsOverviewData(gate.context.access);
    const live = data.source === "database";
    return jsonResponse(
      {
        ok: true,
        available: live,
        kpis: live ? data.kpis : null,
        pipeline: live ? data.pipelineCounts : [],
        leads: live
          ? data.leads.slice(0, MOBILE_LIST_LIMIT).map((l) => ({
              id: l.id, name: l.name, email: l.email, phone: l.phone, company: l.company,
              message: l.messagePreview, status: l.status, priority: l.priority,
              source: l.sourceName, campaign: l.campaignName, followUpAt: l.followUpAt, createdAt: l.createdAt,
            }))
          : [],
        total: live ? data.leads.length : 0,
      },
      200,
    );
  } catch (error) {
    return handleApiError("mobile-leads", error, "Leads could not be loaded.");
  }
}
