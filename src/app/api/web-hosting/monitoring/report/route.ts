import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { getMonitoringRows } from "@/lib/monitoring/store";
import { reportCsv } from "@/lib/monitoring/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const gate = await requireWorkspaceApiPermission("view_reports");
  if (!gate.ok) return gate.response;
  const month = new URL(request.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return jsonResponse({ ok: false, message: "Choose a month (YYYY-MM)." }, 400);
  try {
    const rows = await getMonitoringRows(gate.access.activeClientId);
    return new Response(reportCsv(rows, month), { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="monitoring-${month}.csv"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return handleApiError("monitoring-report", error, "The report is temporarily unavailable."); }
}
