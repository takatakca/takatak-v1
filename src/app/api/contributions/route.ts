import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { listModerationQueue } from "@/lib/contributions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("approve_content");
  if (!gate.ok) return gate.response;

  const publisher = request.nextUrl.searchParams.get("publisher")?.trim() || undefined;
  const status = request.nextUrl.searchParams.get("status")?.trim() || undefined;

  const items = await listModerationQueue({
    clientId: gate.access.activeClientId,
    ...(publisher ? { publisherCode: publisher } : {}),
    ...(status ? { status } : {}),
  });

  return NextResponse.json({ ok: true, items }, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
