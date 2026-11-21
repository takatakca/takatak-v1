// Claude (Anthropic) · 2026-11-21 — native app: TAKATAK invoices for this business (same source and
// permission as /dashboard/invoices). Paying opens the hosted Stripe page in the browser.
import type { NextRequest } from "next/server";

import { getClientInvoices } from "@/lib/billing/client-invoices/client-invoice-service";
import { requireMobileWorkspace } from "@/lib/mobile/mobile-auth";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireMobileWorkspace(request, "manage_settings");
  if (!gate.ok) return gate.response;
  try {
    const result = await getClientInvoices(gate.context.access.activeClientId);
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError("mobile-invoices", error, "Invoices could not be loaded.");
  }
}
