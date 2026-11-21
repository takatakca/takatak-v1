import type { NextRequest } from "next/server";

import { parseGenerateRequest } from "@/lib/ai/generation/prompt";
import { callProvider } from "@/lib/ai/generation/provider-call";
import { generateForWorkspace, type GenerationOutcome, type StudioCallResult } from "@/lib/ai/generation/service";
import { resolveStudioEngine, studioCreditBalance, takbotStudioCall } from "@/lib/ai/generation/studio-engine";
import { getPrisma } from "@/lib/db/prisma";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_CREDITS =
  "Plus de crédits IA dans cet espace : voyez « Moteur IA et crédits » ou demandez à l’équipe TAKATAK. · This workspace has no AI credits left: see “AI Engine & Credits” or ask the TAKATAK team.";

const REFUSALS: Record<Extract<GenerationOutcome, { ok: false }>["reason"], { status: number; message: string }> = {
  daily_limit: { status: 429, message: "Limite quotidienne atteinte pour cet espace ; réessayez demain. · This workspace reached its daily AI limit. Try again tomorrow." },
  voice_not_found: { status: 400, message: "Choisissez une voix de marque de cet espace. · Choose a brand voice from this workspace." },
  timeout: { status: 504, message: "Le moteur IA a pris trop de temps ; réessayez. · The AI engine took too long. Try again." },
  network: { status: 502, message: "Le moteur IA est injoignable ; réessayez sous peu. · The AI engine could not be reached. Try again shortly." },
  rate_limited: { status: 503, message: "Le moteur IA est occupé ; réessayez dans une minute. · The AI engine is busy. Try again in a minute." },
  auth: { status: 503, message: "Le moteur IA a refusé la clé de TAKATAK ; un administrateur doit vérifier. · The AI engine rejected TAKATAK's key. An administrator must check it." },
  provider_error: { status: 502, message: "Le moteur IA a renvoyé une erreur ; réessayez. · The AI engine returned an error. Try again." },
  empty: { status: 502, message: "Aucun texte reçu ; reformulez l’objectif. · No text came back. Try rewording the goal." },
  insufficient_credits: { status: 402, message: NO_CREDITS },
  no_engine: { status: 503, message: "Aucun moteur IA n’est branché pour le moment. · No AI engine is connected right now." },
};

/**
 * Generates one draft in AI Studio for the active workspace. Never publishes.
 * A provider key set for AI Studio runs it at no credit cost; otherwise the
 * TAK-TAK engines write it and the workspace pays the TAK-TAK "write" price
 * in AI credits (refunded when the engine fails).
 */
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;

  // Keys are only resolved for a permitted caller, and never leave the server.
  const engine = await resolveStudioEngine();
  if (engine.kind === "off") {
    return jsonResponse({ ok: false, message: "La génération IA n’est pas disponible pour le moment. · Live AI generation is not available right now." }, 503);
  }

  const body = await readJsonBody(request, 16_384);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);

  const generateRequest = parseGenerateRequest(body.body);
  if (!generateRequest) {
    return jsonResponse({ ok: false, message: "Vérifiez le type de contenu, la plateforme et l’objectif. · Check the content type, platform and goal." }, 400);
  }

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "AI Studio est momentanément indisponible. · AI Studio is temporarily unavailable." }, 503);

  const clientId = gate.access.activeClientId;
  if (engine.kind === "takbot") {
    // Clear refusal before any job is recorded; the ledger stays the authority.
    const balance = await studioCreditBalance(clientId);
    if (balance !== null && balance < engine.credits) {
      return jsonResponse({ ok: false, message: NO_CREDITS, balance }, 402);
    }
  }

  const call =
    engine.kind === "direct"
      ? (prompt: { system: string; user: string }): Promise<StudioCallResult> => callProvider(engine.config, prompt)
      : (prompt: { system: string; user: string }, context: { jobId: string }) => takbotStudioCall(clientId, prompt, context.jobId);

  try {
    const outcome = await generateForWorkspace(prisma, call, {
      clientId,
      profileId: gate.access.profileId ?? null,
      provider: engine.kind === "direct" ? engine.config.provider : "takbot",
      model: engine.kind === "direct" ? engine.config.model : "auto",
      dailyLimit: engine.dailyLimit,
      request: generateRequest,
    });
    if (!outcome.ok) {
      const refusal = REFUSALS[outcome.reason];
      return jsonResponse({ ok: false, message: refusal.message }, refusal.status);
    }
    const credits = typeof outcome.meta.credits === "number" ? outcome.meta.credits : null;
    const balance = typeof outcome.meta.balance === "number" ? outcome.meta.balance : null;
    return jsonResponse(
      { ok: true, outputId: outcome.outputId, title: outcome.title, content: outcome.content, credits, balance },
      200,
    );
  } catch (error) {
    return handleApiError("ai-studio-generate", error, "The draft could not be generated.");
  }
}
