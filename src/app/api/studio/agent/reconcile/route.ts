import type { NextRequest } from "next/server";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { studioEnabled } from "@/lib/studio/production";
import { reconcileStudioJob } from "@/lib/studio/agent-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
/**
 * Operator path to clear a blocked Studio task (reconciliationRequired or a
 * blocking failure code) after reviewing credit activity and saved outputs.
 * Requires manage_jobs in the active workspace. Never re-runs the provider.
 */
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_jobs");
  if (!gate.ok) return gate.response;
  if (!studioEnabled(process.env)) return jsonResponse({ ok: false, code: "studio_disabled" }, 503);
  const body = await readJsonBody(request, 2048);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  const raw = body.body && typeof body.body === "object" && !Array.isArray(body.body) ? body.body as Record<string, unknown> : {};
  if (typeof raw.jobId !== "string" || !UUID.test(raw.jobId) || typeof raw.note !== "string") return jsonResponse({ ok: false, code: "invalid_request" }, 400);
  try {
    const result = await reconcileStudioJob(gate.access.activeClientId, gate.access.profileId, raw.jobId, raw.note);
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (e) { return handleApiError("studio-agent-reconcile", e, "The task could not be reconciled."); }
}
