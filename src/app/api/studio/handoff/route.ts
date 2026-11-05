import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse,handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { assertClientCanUseApprovals } from "@/lib/billing/social/entitlement-gates";
import { studioEnabled,STUDIO_OUTPUT_SOURCE } from "@/lib/studio/production";
import { canHandoff } from "@/lib/studio/agent-policy";
import { studioRecordId } from "@/lib/studio/agent-service";
import { handoffStudioDraft } from "@/lib/studio/handoff-service";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 const gate=await requireWorkspaceApiPermission("create_content");if(!gate.ok)return gate.response;
 if(!studioEnabled(process.env))return jsonResponse({ok:false,code:"studio_disabled"},503);
 const parsed=await readJsonBody(request,4096);if(!parsed.ok)return jsonResponse({ok:false,message:parsed.message},parsed.status);
 const raw=parsed.body as {outputId?:unknown;accountId?:unknown};const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
 if(typeof raw?.outputId!=="string"||typeof raw.accountId!=="string"||!uuid.test(raw.outputId)||!uuid.test(raw.accountId))return jsonResponse({ok:false,code:"invalid_request"},400);
 const db=getPrisma();if(!db)return jsonResponse({ok:false},503);const clientId=gate.access.activeClientId;
 try{
  await assertClientCanUseApprovals(clientId);
  const result=await db.$transaction(tx=>handoffStudioDraft(tx,{clientId,actorId:gate.access.profileId,outputId:raw.outputId as string,accountId:raw.accountId as string},{outputSource:STUDIO_OUTPUT_SOURCE,eligible:canHandoff,recordId:studioRecordId}));
  const {statusCode,...body}=result;
  return jsonResponse({...body,publishing:false},statusCode);
 }catch(e){return handleApiError("studio-handoff",e,"The draft could not be sent to review.");}
}
