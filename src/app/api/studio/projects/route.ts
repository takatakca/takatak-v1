import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { parseStudioBrief, parseStudioPack, storedStudioBrief, studioEnabled, STUDIO_PROJECT_SOURCE, STUDIO_OUTPUT_SOURCE } from "@/lib/studio/production";

import { connectedEngines, creditBalance } from "@/lib/takbot/server";
import { STUDIO_AGENT_SOURCE, STUDIO_SCENE_SOURCE } from "@/lib/studio/agent-policy";
import { studioLibraryMetadata } from "@/lib/studio/library-policy";
import { sanitizeStudioAgentJob } from "@/lib/studio/agent-jobs";
import { DAY_MS, STUDIO_MAX_PROJECTS_PER_DAY, canCreateStudioProject } from "@/lib/studio/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;
  if (!studioEnabled(process.env)) return jsonResponse({ ok: false, code: "studio_disabled" }, 503);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return jsonResponse({ ok: false, code: "invalid_offset" }, 400);
  try {
    const rows = await db.savedAiOutput.findMany({ where: { clientId: gate.access.activeClientId, metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE }, status: { not: "archived" } },
      select: { id: true, content: true, metadata: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, skip: offset });
    const projects = rows.slice(0,20).flatMap((r) => { const brief = storedStudioBrief(r); return brief ? [{ id: r.id, ...brief, createdAt: r.createdAt.toISOString() }] : []; });
    const outputRows = await db.savedAiOutput.findMany({ where: { clientId: gate.access.activeClientId, metadata: { path: ["source"], equals: STUDIO_OUTPUT_SOURCE }, status: { not: "archived" } },
      select: { id: true, title: true, content: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 });
    const outputs=outputRows.map(row=>({...row,metadata:studioLibraryMetadata(row.metadata,STUDIO_OUTPUT_SOURCE)}));
    const [accounts, scenePlans, agentJobs, engineKeys, balance] = await Promise.all([
      db.socialAccount.findMany({where:{clientId:gate.access.activeClientId,status:"connected",accessStatus:{in:["available","selected"]},isAvailableThroughAuth:true},select:{id:true,platform:true,displayName:true,businessBrandId:true},orderBy:{createdAt:"asc"},take:50}),
      db.savedAiOutput.findMany({where:{clientId:gate.access.activeClientId,status:{not:"archived"},AND:[{metadata:{path:["source"],equals:STUDIO_SCENE_SOURCE}},{OR:projects.map(project=>({metadata:{path:["projectId"],equals:project.id}}))}]},select:{id:true,content:true,metadata:true},take:20}),
      db.job.findMany({where:{clientId:gate.access.activeClientId,metadata:{path:["source"],equals:STUDIO_AGENT_SOURCE}},select:{id:true,status:true,scheduledFor:true,errorMessage:true,metadata:true},orderBy:{createdAt:"desc"},take:60}),
      connectedEngines(),creditBalance(gate.access.activeClientId),
    ]);
    // Members see only the whitelisted job view: never operation, fingerprint, actorId, lease tokens or recovery text.
    return jsonResponse({ ok: true, projects, outputs, accounts, scenePlans, agentJobs: agentJobs.map(sanitizeStudioAgentJob), engines:[...engineKeys], balance,
      agentEnabled:process.env.TAKATAK_STUDIO_AGENT_ENABLED==="true", publishingEnabled:false, hasMore: rows.length > 20, nextOffset: rows.length > 20 ? offset + 20 : null }, 200);
  } catch (e) { return handleApiError("studio-projects-list", e, "Studio is temporarily unavailable."); }
}
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;
  if (!studioEnabled(process.env)) return jsonResponse({ ok: false, code: "studio_disabled" }, 503);
  const parsed = await readJsonBody(request, 16384);
  if (!parsed.ok) return jsonResponse({ ok: false, message: parsed.message }, parsed.status);
  const brief = parseStudioBrief(parsed.body) ?? parseStudioPack(parsed.body);
  if (!brief) return jsonResponse({ ok: false, code: "invalid_brief" }, 400);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  try {
    // Per-workspace cap: at most STUDIO_MAX_PROJECTS_PER_DAY briefs per rolling 24 h, archived ones included.
    const createdLast24h = await db.savedAiOutput.count({ where: { clientId: gate.access.activeClientId, metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE }, createdAt: { gte: new Date(Date.now() - DAY_MS) } } });
    if (!canCreateStudioProject(createdLast24h)) return jsonResponse({ ok: false, code: "project_daily_limit", limit: STUDIO_MAX_PROJECTS_PER_DAY }, 429);
    const row = await db.savedAiOutput.create({ data: { clientId: gate.access.activeClientId, kind: "creative_brief", title: brief.title,
      content: JSON.stringify(brief), origin: "manual", status: "draft", metadata: { source: STUDIO_PROJECT_SOURCE, version: 1, createdBy: gate.access.profileId } }, select: { id: true } });
    return jsonResponse({ ok: true, id: row.id }, 201);
  } catch (e) { return handleApiError("studio-project-create", e, "The production could not be saved."); }
}
