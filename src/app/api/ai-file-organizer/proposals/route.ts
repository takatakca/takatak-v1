import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { parseFilingProposalInput } from "@/lib/ai-file-organizer/filing-policy";
import { organizerSettingsFromRow } from "@/lib/ai-file-organizer/settings-policy";
import { hasOrganizerEntitlement } from "@/lib/ai-file-organizer/studio-existing-records";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { STUDIO_OUTPUT_SOURCE, STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scopes = ["pending","approved","rejected","undone"] as const;

export async function GET(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_settings");
  if (!gate.ok) return gate.response;
  if (!hasEffectivePermission(gate.access, "create_content"))
    return jsonResponse({ok:false,code:"forbidden"},403);
  const status = request.nextUrl.searchParams.get("status");
  if (status !== null && !scopes.includes(status as typeof scopes[number]))
    return jsonResponse({ok:false,code:"invalid_status"},400);
  const db = getPrisma();
  if (!db) return jsonResponse({ok:false,code:"unavailable"},503);
  try {
    const items = await db.organizerFilingProposal.findMany({
      where: {clientId:gate.access.activeClientId,...(status?{status}:{})},
      orderBy: [{createdAt:"desc"},{id:"desc"}], take: 51,
      select: {id:true,sourceOutputId:true,destinationProjectId:true,status:true,
        revision:true,createdAt:true,reviewedAt:true,undoneAt:true},
    });
    return jsonResponse({ok:true,items:items.slice(0,50),hasMore:items.length>50,
      storageMode:"metadata_overlay_only",originalsChanged:false},200);
  } catch(e) { return handleApiError("organizer-proposals-list",e,"Filing proposals unavailable."); }
}

/** Manual request only. Idempotency is scoped to the authenticated workspace. */
export async function POST(request: NextRequest) {
  const gate=await requireWorkspaceApiPermission("create_content");
  if(!gate.ok) return gate.response;
  if(!hasEffectivePermission(gate.access,"manage_settings"))
    return jsonResponse({ok:false,code:"forbidden"},403);
  const input=await readJsonBody(request,1024);
  if(!input.ok) return jsonResponse({ok:false,message:input.message},input.status);
  const parsed=parseFilingProposalInput(input.body);
  if(!parsed) return jsonResponse({ok:false,code:"invalid_proposal"},400);
  const clientId=gate.access.activeClientId;
  if(!await hasOrganizerEntitlement(clientId))
    return jsonResponse({ok:false,code:"organizer_unavailable"},403);
  const db=getPrisma();
  if(!db) return jsonResponse({ok:false,code:"unavailable"},503);
  try {
    const result=await db.$transaction(async tx => {
      const policy=organizerSettingsFromRow(
        await tx.organizerWorkspacePolicy.findUnique({where:{clientId}}));
      if(policy.mode!=="suggest" || !policy.consentGranted || policy.providerProcessingConsent ||
        !policy.requireApproval || !policy.allowedSourceKinds.includes("studio") ||
        !policy.allowedDestinationIds.includes(parsed.destinationProjectId))
        return {ok:false as const,status:403,code:"organizer_disabled"};
      const [source,target]=await Promise.all([
        tx.savedAiOutput.findFirst({where:{
          id:parsed.outputId,clientId,origin:"ai_generated",
          status:{in:["saved","draft","sent_to_approval"]},
          metadata:{path:["source"],equals:STUDIO_OUTPUT_SOURCE}},
          select:{id:true,updatedAt:true}}),
        tx.savedAiOutput.findFirst({where:{
          id:parsed.destinationProjectId,clientId,status:{not:"archived"},
          metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},
          select:{id:true}}),
      ]);
      if(!source||!target) return {ok:false as const,status:404,code:"source_or_destination_not_found"};
      const saved=await tx.organizerFilingProposal.create({data:{
        clientId,requestId:parsed.requestId,sourceOutputId:source.id,
        destinationProjectId:target.id,sourceUpdatedAt:source.updatedAt,
        policyRevision:policy.revision,requestedBy:gate.access.profileId,status:"pending",
      },select:{id:true,status:true,revision:true}});
      await tx.auditLog.create({data:{
        clientId,profileId:gate.access.profileId,
        action:"organizer.filing_proposed",entityType:"organizer_filing_proposal",entityId:saved.id,
        metadata:{sourceOutputId:source.id,destinationProjectId:target.id,revision:1,
          origin:"manual",approved:false,providerCalled:false,fileMoved:false},
      }});
      return {ok:true as const,item:saved};
    });
    if(!result.ok) return jsonResponse({ok:false,code:result.code},result.status);
    return jsonResponse({ok:true,item:result.item,approved:false,
      originalChanged:false,providerCalled:false},201);
  }catch(e){
    if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002"){
      const existing=await db.organizerFilingProposal.findUnique({
        where:{clientId_requestId:{clientId,requestId:parsed.requestId}},
        select:{id:true,sourceOutputId:true,destinationProjectId:true,status:true,revision:true},
      });
      if(existing && existing.sourceOutputId===parsed.outputId &&
        existing.destinationProjectId===parsed.destinationProjectId)
        return jsonResponse({ok:true,replayed:true,item:{
          id:existing.id,status:existing.status,revision:existing.revision
        },originalChanged:false,providerCalled:false},200);
      return jsonResponse({ok:false,code:"proposal_conflict"},409);
    }
    return handleApiError("organizer-proposals-create",e,"Filing proposal unavailable.");
  }
}
