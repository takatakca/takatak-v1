import "server-only";

// Native agent runner: runs autopilot agents on the AI engines already
// connected to TAKATAK, so agents work without the external AI Gateway
// (which does not exist yet). When the gateway settings are present, the
// gateway takes over and this runner stays idle.
//
// Scope, on purpose: only agents whose whole job can be done here.
// - Chat Concierge: writes the reply, then posts it in the conversation
//   (after approval, or at once when the workspace turned approval off).
// - Social Autopilot: writes the week's posts; the draft is saved in the
//   workspace library (AI Studio → Saved outputs) to send for publishing.
// Agents that need data or connectors TAKATAK does not have (SMS, analytics,
// ads) are left for the gateway; they are never marked done without acting.
import { Prisma } from "@prisma/client";

import { reportAgentRun } from "@/lib/ai-agents/service";
import { cleanMessage, postAiReply } from "@/lib/chat/service";
import { getPrisma } from "@/lib/db/prisma";
import { AI_AGENTS } from "@/lib/growth/ai-engine";
import { runTakbot } from "@/lib/takbot/server";

import { buildAgentPrompt, NATIVE_AGENT_KEYS, nativeMode, type NativeAgentKey } from "./native-prompts";

const STALE_CLAIM_MS = 30 * 60_000;

/** The external gateway, when configured, owns every run. */
export function nativeRunnerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !(env.TAKATAK_AI_GATEWAY_URL?.trim() && env.TAKATAK_AI_GATEWAY_TOKEN?.trim());
}

interface ClaimedNativeRun {
  runId: string;
  clientId: string;
  agentKey: NativeAgentKey;
  phase: "generate" | "execute";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  instructions: string | null;
  requireApproval: boolean;
}

export interface NativeRunResult {
  runId: string;
  agentKey: string;
  phase: "generate" | "execute";
  outcome: string;
}

function asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function claimNextNativeRun(now: Date): Promise<ClaimedNativeRun | null> {
  const prisma = getPrisma();
  if (!prisma) return null;
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const nativeKeys = [...NATIVE_AGENT_KEYS];
  // A lost generation is safe to redo; a lost execution may have posted, so a person checks it.
  await prisma.aiAgentRun.updateMany({
    where: { agentKey: { in: nativeKeys }, status: "running", claimedAt: { lt: staleBefore } },
    data: { status: "queued", claimedAt: null },
  });
  await prisma.aiAgentRun.updateMany({
    where: { agentKey: { in: nativeKeys }, status: "executing", claimedAt: { lt: staleBefore } },
    data: { status: "failed", claimedAt: null, completedAt: now, error: "execution_interrupted: check the conversation before retrying" },
  });

  const rows = await prisma.$queryRaw<Array<{ id: string; clientId: string; agentKey: string; status: string; input: Prisma.JsonValue; output: Prisma.JsonValue }>>`
    UPDATE "ai_agent_runs" AS r
    SET "status" = (CASE WHEN r."status" = 'queued' THEN 'running' ELSE 'executing' END)::"AiAgentRunStatus",
        "claimedAt" = ${now},
        "updatedAt" = ${now}
    WHERE r."id" = (
      SELECT "id" FROM "ai_agent_runs"
      WHERE "status" IN ('queued', 'approved')
        AND "agentKey" IN ('chat_concierge', 'social_autopilot')
      ORDER BY "createdAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING r."id", r."clientId", r."agentKey", r."status", r."input", r."output"`;
  const row = rows[0];
  if (!row) return null;
  const setting = await prisma.aiAgentSetting.findUnique({
    where: { clientId_agentKey: { clientId: row.clientId, agentKey: row.agentKey } },
    select: { instructions: true, requireApproval: true },
  });
  const def = AI_AGENTS.find((agent) => agent.key === row.agentKey);
  return {
    runId: row.id,
    clientId: row.clientId,
    agentKey: row.agentKey as NativeAgentKey,
    phase: row.status === "running" ? "generate" : "execute",
    input: asRecord(row.input),
    output: row.output ? asRecord(row.output) : null,
    instructions: setting?.instructions ?? null,
    requireApproval: def?.alwaysRequiresApproval ? true : setting?.requireApproval ?? true,
  };
}

async function postConciergeReply(run: ClaimedNativeRun, draft: string): Promise<boolean> {
  const conversationId = typeof run.input.conversationId === "string" ? run.input.conversationId : "";
  const body = cleanMessage(draft);
  if (!conversationId || !body) return false;
  return postAiReply(run.clientId, conversationId, body);
}

async function generate(run: ClaimedNativeRun): Promise<string> {
  const prisma = getPrisma();
  const client = prisma ? await prisma.client.findUnique({ where: { id: run.clientId }, select: { name: true } }) : null;
  const prompt = buildAgentPrompt(run.agentKey, {
    businessName: client?.name ?? "the business",
    instructions: run.instructions,
    input: run.input,
  });
  const result = await runTakbot({
    clientId: run.clientId,
    mode: nativeMode(run.agentKey),
    engine: "auto",
    prompt,
    // One run is billed at most once, even if it is claimed again.
    requestId: `agent-${run.runId}`,
  });
  if (!result.ok) {
    await reportAgentRun(run.runId, { succeeded: false, error: result.code });
    return `failed:${result.code}`;
  }
  const output = {
    draft: result.text,
    engine: result.engineName,
    credits: result.credits,
    savedOutputId: result.savedId ?? null,
    runner: "native",
  };
  // Approval off: the concierge answers at once (the same rule the gateway follows).
  if (run.agentKey === "chat_concierge" && !run.requireApproval) {
    const posted = await postConciergeReply(run, result.text);
    await reportAgentRun(run.runId, {
      succeeded: posted,
      output: { ...output, posted },
      creditsDebited: result.credits,
      error: posted ? null : "conversation_closed",
    });
    return posted ? "posted" : "failed:conversation_closed";
  }
  const report = await reportAgentRun(run.runId, { succeeded: true, output, creditsDebited: result.credits });
  return report.ok ? report.status : `failed:${report.code}`;
}

async function execute(run: ClaimedNativeRun): Promise<string> {
  const draft = typeof run.output?.draft === "string" ? run.output.draft : "";
  if (run.agentKey === "chat_concierge") {
    const posted = await postConciergeReply(run, draft);
    await reportAgentRun(run.runId, {
      succeeded: posted,
      output: { ...(run.output ?? {}), posted },
      error: posted ? null : "conversation_closed",
    });
    return posted ? "posted" : "failed:conversation_closed";
  }
  // Social Autopilot: the approved week of posts is the deliverable; it is in
  // the workspace library, ready to send for publishing. Nothing is published here.
  await reportAgentRun(run.runId, {
    succeeded: Boolean(draft),
    output: { ...(run.output ?? {}), approvedDraftInLibrary: Boolean(draft) },
    error: draft ? null : "empty_draft",
  });
  return draft ? "completed" : "failed:empty_draft";
}

/** Processes up to `max` native agent runs. Safe to call from a cron tick or an admin action. */
export async function runNativeAgentBatch(options: { max?: number; now?: Date } = {}): Promise<NativeRunResult[]> {
  if (!nativeRunnerEnabled() || !getPrisma()) return [];
  const results: NativeRunResult[] = [];
  const max = Math.min(Math.max(options.max ?? 2, 1), 5);
  for (let i = 0; i < max; i += 1) {
    const run = await claimNextNativeRun(options.now ?? new Date());
    if (!run) break;
    let outcome: string;
    try {
      outcome = run.phase === "generate" ? await generate(run) : await execute(run);
    } catch (error) {
      console.error("[native-agents] run failed:", error instanceof Error ? error.message : "unknown");
      await reportAgentRun(run.runId, { succeeded: false, error: "runner_error" }).catch(() => undefined);
      outcome = "failed:runner_error";
    }
    results.push({ runId: run.runId, agentKey: run.agentKey, phase: run.phase, outcome });
  }
  return results;
}
