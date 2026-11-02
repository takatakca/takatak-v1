import type { NextRequest } from "next/server";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { monitoringPortal, startMonitoringCheckout } from "@/lib/monitoring/billing";
import { record, uuid } from "@/lib/monitoring/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_settings");
  if (!gate.ok) return gate.response;
  const result = await readJsonBody(request, 2048);
  if (!result.ok) return jsonResponse({ ok: false, message: result.message }, result.status);
  const input = record(result.body), id = uuid.safeParse(input.domainAssetId);
  if (!id.success || !["checkout", "portal"].includes(String(input.action))) return jsonResponse({ ok: false, message: "Choose a website and billing action." }, 400);
  try {
    const clientId = gate.access.activeClientId;
    const url = input.action === "portal" ? await monitoringPortal(clientId, id.data)
      : await startMonitoringCheckout(clientId, id.data, input.acceptedTerms === true);
    return jsonResponse({ ok: true, url }, 200);
  } catch (error) { return handleApiError("monitoring-billing", error, "Monitoring billing is temporarily unavailable."); }
}
