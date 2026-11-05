import type { NextRequest } from "next/server";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { jsonResponse,handleApiError } from "@/lib/security/api-response";
import { studioEnabled } from "@/lib/studio/production";
import { parseAgentPlan } from "@/lib/studio/agent-policy";
import { queueStudioPlan } from "@/lib/studio/agent-service";
import { creditsFor,takbotMode } from "@/lib/takbot/catalog";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const gate=await requireWorkspaceApiPermission("create_content");if(!gate.ok)return gate.response;
 if(!studioEnabled(process.env))return jsonResponse({ok:false,code:"studio_disabled"},503);
 const body=await readJsonBody(request,4096);if(!body.ok)return jsonResponse({ok:false,message:body.message},body.status);
 const mode=takbotMode("write");const plan=parseAgentPlan(body.body,mode?creditsFor(mode):0);if(!plan)return jsonResponse({ok:false,message:"Choose 1–7 days, at least one format and a sufficient credit ceiling."},400);
 try{const result=await queueStudioPlan(gate.access.activeClientId,gate.access.profileId,plan);return jsonResponse({ok:true,...result,runnerEnabled:process.env.TAKATAK_STUDIO_AGENT_ENABLED==="true",publishing:false},202);}catch(e){return handleApiError("studio-agent-queue",e,"The agent plan could not be queued.");}
}
