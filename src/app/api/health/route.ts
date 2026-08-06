import { NextResponse } from "next/server";
import { getDatabaseEnvStatus } from "@/lib/db/env";
import { getMetricoolEnvStatus } from "@/lib/integrations/metricool/env";
import { getUpmindEnvStatus } from "@/lib/integrations/upmind/env";
import { getOpenAiStatus, getTryHoloStatus } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

// Lightweight health check. Config presence only — no queries, no live
// provider calls, no secret values.
//
// Phase 14 — public production health is MINIMAL by default. Detailed
// capability info requires HEALTH_DETAILS_ENABLED=true (or a non-production
// runtime for local QA). Detailed data never includes secret values, and
// the guarded admin System Health page reads server helpers directly.
export function GET() {
  const detailsEnabled =
    process.env.HEALTH_DETAILS_ENABLED === "true" || process.env.NODE_ENV !== "production";
  if (!detailsEnabled) {
    return NextResponse.json({ status: "ok", app: "TAKATAK User Official Dashboard V1" });
  }
  const db = getDatabaseEnvStatus();
  const metricool = getMetricoolEnvStatus();
  const upmind = getUpmindEnvStatus();
  const openai = getOpenAiStatus();
  const tryholo = getTryHoloStatus();
  return NextResponse.json({
    status: "ok",
    app: "TAKATAK User Official Dashboard V1",
    database: {
      configured: db.configured,
      directUrl: db.hasDirectUrl,
    },
    integrations: {
      metricool: {
        configured: metricool.configured,
        state: metricool.configured ? "configured_untested" : "not_configured",
      },
      upmind: {
        configured: upmind.configured,
        state: upmind.configured ? "configured_untested" : "not_configured",
        webhookEnabled: upmind.webhookEnabled,
      },
      openai: { configured: openai.configured, state: openai.state },
      tryholo: { configured: tryholo.configured, state: tryholo.state, enabled: tryholo.enabled },
    },
    reporting: {
      foundation: true,
      exportEnabled: false,
      deliveryEnabled: false,
      aiSummaryEnabled: false,
    },
    localListings: {
      foundation: true,
      qmapsConnected: false,
      googleBusinessConnected: false,
      providerSyncEnabled: false,
    },
    leads: {
      foundation: true,
      flexsConnected: false,
      outreachAutomationEnabled: false,
      crmSyncEnabled: false,
    },
    admin: {
      foundation: true,
      writeActionsEnabled: false,
      jobExecutionEnabled: false,
      providerRepairEnabled: false,
    },
    tenantIsolation: {
      // Phase 15A — truthful implementation status:
      serverQueryScoping: true, // all module data layers filter by TenantAccess
      profileMapping: true, // auth user ↔ Profile via authUserId; sync on callback
      membershipEnforcement: true, // no membership → denied; no owner defaults
      twoTenantTestPassed: true, // scripts/check-tenant-isolation.ts (16 checks) — rerun via npm run qa:tenant-isolation
      liveSupabaseVerified: false, // still requires a real Supabase project (staging)
    },
  });
}
