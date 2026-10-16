import type { NextRequest } from "next/server";

import { readAiStudioConfig } from "@/lib/ai/generation/config";
import { parseGenerateRequest } from "@/lib/ai/generation/prompt";
import { callProvider } from "@/lib/ai/generation/provider-call";
import { generateForWorkspace, type GenerationOutcome } from "@/lib/ai/generation/service";
import { getPrisma } from "@/lib/db/prisma";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFUSALS: Record<Extract<GenerationOutcome, { ok: false }>["reason"], { status: number; message: string }> = {
  daily_limit: { status: 429, message: "This workspace reached its daily AI generation limit. Try again tomorrow." },
  voice_not_found: { status: 400, message: "Choose a brand voice from this workspace." },
  timeout: { status: 504, message: "The AI provider took too long. Try again." },
  network: { status: 502, message: "The AI provider could not be reached. Try again shortly." },
  rate_limited: { status: 503, message: "The AI provider is busy. Try again in a minute." },
  auth: { status: 503, message: "The AI provider rejected TAKATAK's credentials. An administrator must check the configuration." },
  provider_error: { status: 502, message: "The AI provider returned an error. Try again." },
  empty: { status: 502, message: "The AI provider returned no text. Try rewording the goal." },
};

/** Generates one draft in AI Studio for the active workspace. Never publishes. */
export async function POST(request: NextRequest) {
  const config = readAiStudioConfig();
  if (!config.enabled) return jsonResponse({ ok: false, message: "Live AI generation is not enabled." }, 503);

  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request, 16_384);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);

  const generateRequest = parseGenerateRequest(body.body);
  if (!generateRequest) return jsonResponse({ ok: false, message: "Check the content type, platform and goal." }, 400);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "AI Studio is temporarily unavailable." }, 503);

  try {
    const outcome = await generateForWorkspace(prisma, (prompt) => callProvider(config, prompt), {
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId ?? null,
      provider: config.provider,
      model: config.model,
      dailyLimit: config.dailyLimit,
      request: generateRequest,
    });
    if (!outcome.ok) {
      const refusal = REFUSALS[outcome.reason];
      return jsonResponse({ ok: false, message: refusal.message }, refusal.status);
    }
    return jsonResponse(
      { ok: true, outputId: outcome.outputId, title: outcome.title, content: outcome.content },
      200,
    );
  } catch (error) {
    return handleApiError("ai-studio-generate", error, "The draft could not be generated.");
  }
}
