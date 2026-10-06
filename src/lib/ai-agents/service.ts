import "server-only";

// AI agent workforce: per-client agent settings and an approval-gated run
// queue. The gateway claims work with row locks (FOR UPDATE SKIP LOCKED), so
// two workers can never take the same run.
//
// queued ──claim──▶ running ──report ok──▶ awaiting_approval ──approve──▶ approved ──claim──▶ executing ──report ok──▶ completed
//                     │                     (or completed when approval is off)       └─reject─▶ rejected
//                     └─report fail──▶ failed                                         executing ──report fail──▶ failed

import { Prisma, type AiAgentRunStatus } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { AI_AGENTS } from "@/lib/growth/ai-engine";

const STALE_CLAIM_MS = 30 * 60_000;
const MAX_OUTPUT_BYTES = 64_000;

function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("database_unavailable");
  return prisma;
}

function agentDef(agentKey: string) {
  return AI_AGENTS.find((a) => a.key === agentKey) ?? null;
}

export interface AgentSettingView {
  key: string;
  name: string;
  mission: string;
  enabled: boolean;
  requireApproval: boolean;
  approvalLocked: boolean;
  instructions: string | null;
}

export async function listAgentSettings(clientId: string): Promise<AgentSettingView[]> {
  const rows = await requirePrisma().aiAgentSetting.findMany({ where: { clientId } });
  const byKey = new Map(rows.map((r) => [r.agentKey, r]));
  return AI_AGENTS.map((agent) => {
    const row = byKey.get(agent.key);
    return {
      key: agent.key,
      name: agent.name,
      mission: agent.mission,
      enabled: row?.enabled ?? false,
      requireApproval: agent.alwaysRequiresApproval ? true : row?.requireApproval ?? true,
      approvalLocked: Boolean(agent.alwaysRequiresApproval),
      instructions: row?.instructions ?? null,
    };
  });
}

export async function saveAgentSetting(
  clientId: string,
  agentKey: string,
  input: { enabled: boolean; requireApproval: boolean; instructions: string | null },
): Promise<boolean> {
  const agent = agentDef(agentKey);
  if (!agent) return false;
  const requireApproval = agent.alwaysRequiresApproval ? true : input.requireApproval;
  const instructions = input.instructions?.trim().slice(0, 2000) || null;
  await requirePrisma().aiAgentSetting.upsert({
    where: { clientId_agentKey: { clientId, agentKey } },
    create: { clientId, agentKey, enabled: input.enabled, requireApproval, instructions },
    update: { enabled: input.enabled, requireApproval, instructions },
  });
  return true;
}

export type RequestRunResult = { ok: true; runId: string } | { ok: false; error: "unknown_agent" | "agent_disabled" | "already_pending" };

export async function requestAgentRun(
  clientId: string,
  agentKey: string,
  input: { trigger?: string; brief?: string | null },
  profileId: string | null,
): Promise<RequestRunResult> {
  if (!agentDef(agentKey)) return { ok: false, error: "unknown_agent" };
  const prisma = requirePrisma();
  const setting = await prisma.aiAgentSetting.findUnique({ where: { clientId_agentKey: { clientId, agentKey } }, select: { enabled: true } });
  if (!setting?.enabled) return { ok: false, error: "agent_disabled" };
  const pending = await prisma.aiAgentRun.count({
    where: { clientId, agentKey, status: { in: ["queued", "running", "awaiting_approval", "approved", "executing"] } },
  });
  if (pending > 0) return { ok: false, error: "already_pending" };
  const brief = input.brief?.trim().slice(0, 2000) || null;
  const run = await prisma.aiAgentRun.create({
    data: {
      clientId,
      agentKey,
      trigger: (input.trigger ?? "manual").slice(0, 40),
      input: brief ? { brief } : Prisma.JsonNull,
      requestedByProfileId: profileId,
    },
    select: { id: true },
  });
  return { ok: true, runId: run.id };
}

export interface RunView {
  id: string;
  agentKey: string;
  agentName: string;
  status: AiAgentRunStatus;
  trigger: string;
  brief: string | null;
  summary: string | null;
  preview: string | null;
  creditsDebited: number;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

function outputText(output: Prisma.JsonValue | null, key: "summary" | "preview"): string | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const value = (output as Record<string, unknown>)[key];
  return typeof value === "string" ? value.slice(0, key === "summary" ? 500 : 4000) : null;
}

export async function listAgentRuns(clientId: string, limit = 30): Promise<RunView[]> {
  const runs = await requirePrisma().aiAgentRun.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: limit });
  return runs.map((r) => ({
    id: r.id,
    agentKey: r.agentKey,
    agentName: agentDef(r.agentKey)?.name ?? r.agentKey,
    status: r.status,
    trigger: r.trigger,
    brief:
      r.input && typeof r.input === "object" && !Array.isArray(r.input) && typeof (r.input as Record<string, unknown>).brief === "string"
        ? ((r.input as Record<string, unknown>).brief as string)
        : null,
    summary: outputText(r.output, "summary"),
    preview: outputText(r.output, "preview"),
    creditsDebited: r.creditsDebited,
    error: r.error,
    createdAt: r.createdAt,
    completedAt: r.completedAt,
  }));
}

export async function decideAgentRun(clientId: string, runId: string, approve: boolean, profileId: string | null): Promise<boolean> {
  const result = await requirePrisma().aiAgentRun.updateMany({
    where: { id: runId, clientId, status: "awaiting_approval" },
    data: approve
      ? { status: "approved", decidedByProfileId: profileId, decidedAt: new Date() }
      : { status: "rejected", decidedByProfileId: profileId, decidedAt: new Date(), completedAt: new Date() },
  });
  return result.count === 1;
}

export async function cancelAgentRun(clientId: string, runId: string): Promise<boolean> {
  const result = await requirePrisma().aiAgentRun.updateMany({
    where: { id: runId, clientId, status: { in: ["queued", "awaiting_approval", "approved"] } },
    data: { status: "canceled", completedAt: new Date() },
  });
  return result.count === 1;
}

// ------------------------------------------------------------------ gateway

export interface ClaimedRun {
  runId: string;
  clientId: string;
  agentKey: string;
  phase: "generate" | "execute";
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  instructions: string | null;
  requireApproval: boolean;
}

/** Re-queues runs whose worker vanished, then atomically claims the oldest runnable one. */
export async function claimNextAgentRun(now = new Date()): Promise<ClaimedRun | null> {
  const prisma = requirePrisma();
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  await prisma.aiAgentRun.updateMany({ where: { status: "running", claimedAt: { lt: staleBefore } }, data: { status: "queued", claimedAt: null } });
  await prisma.aiAgentRun.updateMany({ where: { status: "executing", claimedAt: { lt: staleBefore } }, data: { status: "approved", claimedAt: null } });

  const rows = await prisma.$queryRaw<Array<{ id: string; clientId: string; agentKey: string; status: AiAgentRunStatus; input: Prisma.JsonValue; output: Prisma.JsonValue }>>`
    UPDATE "ai_agent_runs" AS r
    SET "status" = (CASE WHEN r."status" = 'queued' THEN 'running' ELSE 'executing' END)::"AiAgentRunStatus",
        "claimedAt" = ${now},
        "updatedAt" = ${now}
    WHERE r."id" = (
      SELECT "id" FROM "ai_agent_runs"
      WHERE "status" IN ('queued', 'approved')
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
  return {
    runId: row.id,
    clientId: row.clientId,
    agentKey: row.agentKey,
    phase: row.status === "running" ? "generate" : "execute",
    input: row.input,
    output: row.output,
    instructions: setting?.instructions ?? null,
    requireApproval: agentDef(row.agentKey)?.alwaysRequiresApproval ? true : setting?.requireApproval ?? true,
  };
}

export type ReportResult = { ok: true; status: AiAgentRunStatus } | { ok: false; code: "not_found" | "not_claimed" | "invalid_request" };

export async function reportAgentRun(
  runId: string,
  report: { succeeded: boolean; output?: unknown; creditsDebited?: number; error?: string | null },
): Promise<ReportResult> {
  const credits = report.creditsDebited ?? 0;
  if (!Number.isInteger(credits) || credits < 0 || credits > 100_000) return { ok: false, code: "invalid_request" };
  let output: Prisma.InputJsonValue | undefined;
  if (report.output !== undefined) {
    const serialized = JSON.stringify(report.output);
    if (!serialized || serialized.length > MAX_OUTPUT_BYTES) return { ok: false, code: "invalid_request" };
    output = JSON.parse(serialized) as Prisma.InputJsonValue;
  }
  const prisma = requirePrisma();
  const run = await prisma.aiAgentRun.findUnique({ where: { id: runId }, select: { status: true, clientId: true, agentKey: true } });
  if (!run) return { ok: false, code: "not_found" };
  if (run.status !== "running" && run.status !== "executing") return { ok: false, code: "not_claimed" };

  let next: AiAgentRunStatus;
  if (!report.succeeded) next = "failed";
  else if (run.status === "executing") next = "completed";
  else {
    const setting = await prisma.aiAgentSetting.findUnique({
      where: { clientId_agentKey: { clientId: run.clientId, agentKey: run.agentKey } },
      select: { requireApproval: true },
    });
    const needsApproval = agentDef(run.agentKey)?.alwaysRequiresApproval ? true : setting?.requireApproval ?? true;
    next = needsApproval ? "awaiting_approval" : "completed";
  }
  const terminal = next === "completed" || next === "failed";
  const updated = await prisma.aiAgentRun.updateMany({
    where: { id: runId, status: run.status },
    data: {
      status: next,
      ...(output !== undefined ? { output } : {}),
      creditsDebited: { increment: credits },
      error: report.succeeded ? null : (report.error ?? "failed").slice(0, 500),
      completedAt: terminal ? new Date() : null,
    },
  });
  if (updated.count !== 1) return { ok: false, code: "not_claimed" };
  return { ok: true, status: next };
}
