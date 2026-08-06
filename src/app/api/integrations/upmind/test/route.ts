import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/security/api-access";
import { testConnection } from "@/lib/integrations/upmind/adapter";
import { recordUpmindTestResult } from "@/lib/integrations/upmind/upmind-service";

export const dynamic = "force-dynamic";

// Attempts a REAL test connection. Never returns/logs the API key.
// Never exposes stack traces. "connected" only on a real successful call.
export async function POST() {
  // Phase 14 — admin-only: 401/403 when auth is configured; foundation mode
  // allowed for local QA; 503 in production-blocked mode.
  const access = await requireAdminApiAccess();
  if (!access.ok) return access.response;
  const result = await testConnection();
  let persisted = { persisted: false };
  if (result.state === "connected" || result.state === "error") {
    persisted = await recordUpmindTestResult(result);
  }
  return NextResponse.json({ provider: "upmind", ...result, dbUpdated: persisted.persisted });
}
