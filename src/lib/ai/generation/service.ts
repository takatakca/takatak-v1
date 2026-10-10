// Runs one AI Studio generation for a workspace and saves the result as an
// "ai_generated" draft. Nothing is published or sent anywhere.
//
// Order: daily cap → brand voice must belong to the workspace → job row
// (running) → provider call → output + job completion in one transaction.

import type { Prisma } from "@prisma/client";

import type { AiStudioProvider } from "./config";
import type { GenerationResult } from "./provider-call";
import { buildPrompt, outputTitle, type GenerateRequest, type VoiceForPrompt } from "./prompt";

type Db = Pick<Prisma.TransactionClient, "aiContentJob" | "brandVoice" | "savedAiOutput" | "aiProviderEvent">;
export interface GenerationDb extends Db {
  $transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

export type GenerationOutcome =
  | { ok: true; outputId: string; jobId: string; title: string; content: string }
  | { ok: false; reason: "daily_limit" | "voice_not_found" | Extract<GenerationResult, { ok: false }>["code"] };

const DAY_MS = 24 * 60 * 60 * 1000;

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 30) : [];
}

/** Marks AI Studio generation jobs, so the daily cap counts only them. */
export const GENERATION_SOURCE = "ai_studio_generation";

/**
 * The `AiProvider` database enum has no `anthropic` value, and adding one is a
 * migration that needs owner approval. Claude jobs are stored as `internal`
 * (a model called from TAKATAK's server); the real vendor is always in
 * `metadata.provider`.
 */
export function dbProvider(provider: AiStudioProvider): "openai" | "internal" {
  return provider === "openai" ? "openai" : "internal";
}

export async function generateForWorkspace(
  db: GenerationDb,
  call: (prompt: { system: string; user: string }) => Promise<GenerationResult>,
  input: {
    clientId: string;
    profileId: string | null;
    provider: AiStudioProvider;
    model: string;
    dailyLimit: number;
    request: GenerateRequest;
    now?: Date;
  },
): Promise<GenerationOutcome> {
  const now = input.now ?? new Date();
  const { request } = input;

  const usedToday = await db.aiContentJob.count({
    where: {
      clientId: input.clientId,
      metadata: { path: ["source"], equals: GENERATION_SOURCE },
      status: { in: ["running", "completed", "failed"] },
      createdAt: { gte: new Date(now.getTime() - DAY_MS) },
    },
  });
  if (usedToday >= input.dailyLimit) return { ok: false, reason: "daily_limit" };

  let voice: (VoiceForPrompt & { id: string; businessBrandId: string | null }) | null = null;
  if (request.brandVoiceId) {
    const row = await db.brandVoice.findFirst({
      where: { id: request.brandVoiceId, clientId: input.clientId },
      select: {
        id: true, businessBrandId: true, name: true, tone: true, audience: true,
        keywords: true, bannedPhrases: true, sampleCaption: true, notes: true,
      },
    });
    if (!row) return { ok: false, reason: "voice_not_found" };
    voice = { ...row, keywords: strings(row.keywords), bannedPhrases: strings(row.bannedPhrases) };
  }

  const job = await db.aiContentJob.create({
    data: {
      clientId: input.clientId,
      businessBrandId: voice?.businessBrandId ?? null,
      brandVoiceId: voice?.id ?? null,
      provider: dbProvider(input.provider),
      kind: request.kind,
      status: "running",
      promptSummary: `${request.platform} · ${request.goal}`.slice(0, 300),
      startedAt: now,
      metadata: {
        source: GENERATION_SOURCE,
        provider: input.provider,
        model: input.model,
        language: request.language,
        requestedBy: input.profileId,
      },
    },
    select: { id: true },
  });

  let result: GenerationResult;
  try {
    result = await call(buildPrompt(request, voice));
  } catch {
    result = { ok: false, code: "network" };
  }

  if (!result.ok) {
    await db.aiContentJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: result.code, completedAt: new Date() },
    });
    await db.aiProviderEvent.create({
      data: {
        provider: dbProvider(input.provider),
        eventType: "generation",
        status: "failed",
        message: result.code,
        metadata: { clientId: input.clientId, jobId: job.id, provider: input.provider, model: input.model },
      },
    });
    return { ok: false, reason: result.code };
  }

  const title = outputTitle(request);
  const output = await db.$transaction(async (tx) => {
    const saved = await tx.savedAiOutput.create({
      data: {
        clientId: input.clientId,
        businessBrandId: voice?.businessBrandId ?? null,
        brandVoiceId: voice?.id ?? null,
        aiContentJobId: job.id,
        kind: request.kind,
        title,
        content: result.text,
        origin: "ai_generated",
        status: "draft",
        metadata: {
          platform: request.platform,
          language: request.language,
          provider: input.provider,
          model: input.model,
          requestedBy: input.profileId,
        },
      },
      select: { id: true },
    });
    await tx.aiContentJob.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date() },
    });
    await tx.aiProviderEvent.create({
      data: {
        provider: dbProvider(input.provider),
        eventType: "generation",
        status: "succeeded",
        metadata: {
          clientId: input.clientId,
          jobId: job.id,
          provider: input.provider,
          model: input.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      },
    });
    return saved;
  });

  return { ok: true, outputId: output.id, jobId: job.id, title, content: result.text };
}
