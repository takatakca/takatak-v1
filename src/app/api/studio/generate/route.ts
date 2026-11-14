import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { studioGenerationDependencies } from "@/lib/studio/generation-dependencies";
import { generateStudioDraft, parseStudioGeneration, studioEnabled } from "@/lib/studio/production";
import { STUDIO_GENERATE_PER_MINUTE, createStudioRateLimiter } from "@/lib/studio/limits";

// In-memory, per process instance (see docs/studio/COST_CONTROLS.md): a burst brake, not a billing control.
const limiter = createStudioRateLimiter({ limit: STUDIO_GENERATE_PER_MINUTE, windowMs: 60_000 });

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
  const slot = limiter.take(gate.access.activeClientId);
  if (!slot.ok) {
    const response = jsonResponse({ ok: false, code: "rate_limited", retryAfterMs: slot.retryAfterMs }, 429);
    response.headers.set("Retry-After", String(Math.ceil(slot.retryAfterMs / 1000)));
    return response;
  }
  try {
    const result = await generateStudioDraft(studioGenerationDependencies(db), gate.access.activeClientId, input);
    return jsonResponse(result, result.status);
  } catch (e) { return handleApiError("studio-generate", e, "The request could not be confirmed. Check saved outputs before starting another generation."); }
}
