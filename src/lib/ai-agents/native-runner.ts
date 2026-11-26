import "server-only";

// Native agent runner: runs autopilot agents on the AI engines already
// connected to TAKATAK (TAK-TAK), so agents work without the external AI
// Gateway. When the gateway settings are present, the gateway takes over and
// this runner stays idle.
//
// Scope, on purpose: only agents whose whole job can be done here.
// - Chat Concierge: writes the reply, then posts it in the conversation
//   (after approval, or at once when the workspace turned approval off).
// - Social Autopilot: writes the week's posts; the draft is saved in the
//   workspace library (AI Studio → Saved outputs) to send for publishing.
// - Report Writer: reads the workspace's real numbers for the month and writes
//   the plain-language summary with next steps (billed as the published
//   "monthly report summary" action).
// - SEO Watchdog: re-checks the client's websites (the same SSRF-guarded check
//   as the SEO screen, saved to the score history), flags what newly fails,
//   and writes a prioritized fix list.
// Agents that need connectors TAKATAK does not have here (SMS, ads accounts)
// are left for the gateway; they are never marked done without acting.
import { Prisma } from "@prisma/client";

import { reportAgentRun } from "@/lib/ai-agents/service";
import { cleanMessage, postAiReply } from "@/lib/chat/service";
import { getPrisma } from "@/lib/db/prisma";
import { AI_AGENTS } from "@/lib/growth/ai-engine";
import { getGrowthReport } from "@/lib/growth/report";
import { auditKey, latestByUrl } from "@/lib/seo/score-history";
import { listSeoScores, recordSeoScore } from "@/lib/seo/score-store";
import { runSiteAudit } from "@/lib/seo/site-audit";
import { runTakbot } from "@/lib/takbot/server";

import {
  buildAgentPrompt,
  compareSiteCheck,
  externalGatewayConfigured,
  NATIVE_AGENT_KEYS,
  nativeActionKey,
  nativeMode,
  nativeSummary,
  reportFactLines,
  reportPeriod,
  seoFactLines,
  type NativeAgentKey,
  type SiteCheckFacts,
} from "./native-prompts";

const STALE_CLAIM_MS = 30 * 60_000;
/** Sites the SEO Watchdog re-checks per run (checked in parallel to stay inside one cron tick). */
const SEO_SITES_PER_RUN = 2;

/** The external gateway, when configured, owns every run. */
export function nativeRunnerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !externalGatewayConfigured(env);
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
        AND "agentKey" IN (${Prisma.join(nativeKeys)})
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

type Facts = { ok: true; lines: string[]; extra: Record<string, unknown> } | { ok: false; error: string };

/** Measures what the agent writes about: nothing is debited when this fails. */
async function gatherFacts(run: ClaimedNativeRun): Promise<Facts> {
  const prisma = getPrisma();
  if (!prisma) return { ok: false, error: "database_unavailable" };
  if (run.agentKey === "report_writer") {
    const period = reportPeriod(new Date(), run.input.month);
    const report = await getGrowthReport(run.clientId, period.key);
    if (!report) return { ok: false, error: "report_unavailable" };
    return {
      ok: true,
      lines: reportFactLines({ monthLabel: report.month.label, monthToDate: period.monthToDate, current: report.current, previous: report.previous }),
      extra: { month: report.month.key, monthToDate: period.monthToDate },
    };
  }
  if (run.agentKey === "seo_watchdog") {
    const latest = latestByUrl(await listSeoScores(prisma, run.clientId));
    let urls = latest.map((row) => row.url);
    if (!urls.length) {
      const brands = await prisma.businessBrand.findMany({
        where: { clientId: run.clientId, website: { not: null } },
        select: { website: true },
        take: 5,
      });
      urls = brands.flatMap((brand) => (brand.website?.trim() ? [brand.website.trim()] : []));
    }
    urls = [...new Set(urls)].slice(0, SEO_SITES_PER_RUN);
    if (!urls.length) return { ok: false, error: "no_website_on_file" };
    const audits = await Promise.all(urls.map((url) => runSiteAudit(url).catch(() => null)));
    const sites: SiteCheckFacts[] = [];
    for (const audit of audits) {
      if (!audit?.ok) continue;
      const key = auditKey(audit.report.requestedUrl);
      const previous = latest.find((row) => auditKey(row.url) === key) ?? null;
      // The check joins the SEO score history, like a check run from the SEO screen.
      await recordSeoScore(prisma, { clientId: run.clientId, profileId: null, report: audit.report }).catch(() => false);
      sites.push(compareSiteCheck(audit.report, previous));
    }
    if (!sites.length) return { ok: false, error: "site_unreachable" };
    return {
      ok: true,
      lines: seoFactLines(sites),
      extra: { sites: sites.map((site) => ({ url: site.url, score: site.score, previousScore: site.previousScore, regressions: site.regressions.length })) },
    };
  }
  return { ok: true, lines: [], extra: {} };
}

async function generate(run: ClaimedNativeRun): Promise<string> {
  const prisma = getPrisma();
  const facts = await gatherFacts(run);
  if (!facts.ok) {
    await reportAgentRun(run.runId, { succeeded: false, error: facts.error });
    return `failed:${facts.error}`;
  }
  const client = prisma ? await prisma.client.findUnique({ where: { id: run.clientId }, select: { name: true } }) : null;
  const prompt = buildAgentPrompt(run.agentKey, {
    businessName: client?.name ?? "the business",
    instructions: run.instructions,
    input: run.input,
    facts: facts.lines,
  });
  const result = await runTakbot({
    clientId: run.clientId,
    mode: nativeMode(run.agentKey),
    engine: "auto",
    prompt,
    // One run is billed at most once, even if it is claimed again.
    requestId: `agent-${run.runId}`,
    actionKey: nativeActionKey(run.agentKey),
  });
  if (!result.ok) {
    await reportAgentRun(run.runId, { succeeded: false, error: result.code });
    return `failed:${result.code}`;
  }
  const output = {
    ...facts.extra,
    summary: nativeSummary(run.agentKey),
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
  // Social Autopilot, Report Writer, SEO Watchdog: the approved draft is the
  // deliverable; it is in the workspace library (AI Studio → Saved outputs).
  // Nothing is published here.
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
