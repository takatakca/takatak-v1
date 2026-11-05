import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { runTakbot } from "@/lib/takbot/server";
import { generateStudioDraft, parseStudioGeneration, studioEnabled, STUDIO_OUTPUT_SOURCE, STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;
  if (!studioEnabled(process.env)) return jsonResponse({ ok: false, code: "studio_disabled" }, 503);
  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message }, parsed.status);
  const input = parseStudioGeneration(parsed.body);
  if (!input) return jsonResponse({ ok: false, code: "invalid_request" }, 400);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  try {
    const result = await generateStudioDraft({
      findProject: (clientId, id) => db.savedAiOutput.findFirst({ where: { id, clientId, status: { not: "archived" }, metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE } }, select: { content: true, metadata: true } }),
      run: runTakbot,
      linkOutput: async (clientId, outputId, projectId, track) => {
        const claimed = await db.savedAiOutput.updateMany({ where: { id: outputId, clientId, origin: "ai_generated", status: "saved", metadata: { path: ["source"], equals: "takbot" } },
          data: { status: "draft", metadata: { source: STUDIO_OUTPUT_SOURCE, version: 1, projectId, track, generatedBy: "takbot", knowledge: "not_retrieved" } } });
        return claimed.count === 1;
      },
    }, gate.access.activeClientId, input);
    return jsonResponse(result, result.status);
  } catch (e) { return handleApiError("studio-generate", e, "The request could not be confirmed. Check saved outputs before starting another generation."); }
}
