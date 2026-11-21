// Claude (Anthropic) · 2026-11-21 — native app round 2: domains and hosting for the business (same loader,
// scope and permission as /dashboard/web-hosting). Client-scoped only, so it never falls back to demo data.
import type { NextRequest } from "next/server";

import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { MOBILE_LIST_LIMIT } from "@/lib/mobile/mobile-session";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { getWebHostingOverviewData } from "@/lib/web-hosting/web-hosting-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "view_dashboard");
  if (!gate.ok) return gate.response;
  try {
    const data = await getWebHostingOverviewData(gate.context.access);
    const live = data.source === "database";
    return jsonResponse(
      {
        ok: true,
        available: live,
        domains: live
          ? data.domains.slice(0, MOBILE_LIST_LIMIT).map((d) => ({
              id: d.id, name: d.domainName, brand: d.brandName, registrar: d.registrar, status: d.status,
              dns: d.dnsStatus, ssl: d.sslStatus, autoRenew: d.autoRenew, expiresAt: d.expiresAt,
            }))
          : [],
        hosting: live
          ? data.hostingServices.slice(0, MOBILE_LIST_LIMIT).map((h) => ({
              id: h.id, plan: h.planName, brand: h.brandName, domain: h.primaryDomain, status: h.status,
              server: h.serverStatus, renewsAt: h.renewalDate,
            }))
          : [],
      },
      200,
    );
  } catch (error) {
    return handleApiError("mobile-web", error, "Websites could not be loaded.");
  }
}
