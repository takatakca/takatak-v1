import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { studioEnabled, STUDIO_OUTPUT_SOURCE } from "@/lib/studio/production";
import { listStudioLibrary, parseStudioLibraryFilter } from "@/lib/studio/library-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;
  if (!studioEnabled(process.env)) return jsonResponse({ ok: false, code: "studio_disabled" }, 503);
  const filter = parseStudioLibraryFilter(request.nextUrl.searchParams);
  if (!filter) return jsonResponse({ ok: false, code: "invalid_library_filter" }, 400);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  try {
    const page = await listStudioLibrary(query => db.savedAiOutput.findMany(query), gate.access.activeClientId, filter, STUDIO_OUTPUT_SOURCE);
    return jsonResponse({ ok: true, ...page }, 200);
  } catch (e) {
    return handleApiError("studio-library-list", e, "The draft library is temporarily unavailable.");
  }
}
