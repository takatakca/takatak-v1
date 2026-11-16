import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { decideFilingTransition,parseFilingDecisionInput,type FilingStatus } from "@/lib/ai-file-organizer/filing-policy";
import { organizerSettingsFromRow } from "@/lib/ai-file-organizer/settings-policy";
import { hasOrganizerEntitlement } from "@/lib/ai-file-organizer/studio-existing-records";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse,handleApiError } from "@/lib/security/api-response";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { STUDIO_OUTPUT_SOURCE, STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const gate=await requireWorkspaceApiPermission("manage_settings");
  if(!gate.ok) return gate.response;
  if(!hasEffectivePermission(gate.access,"create_content"))
    return jsonResponse({ok:false,code:"forbidden"},403);
  const {id}=await params;
  if(!UUID.test(id)) return jsonResponse({ok:false,code:"not_found"},404);
  const body=await readJsonBody(request,1024);
  if(!body.ok) return jsonResponse({ok:false,message:body.message},body.status);
  const parsed=parseFilingDecisionInput(body.body);
  if(!parsed) return jsonResponse({ok:false,code:"invalid_decision"},400);
  const clientId=gate.access.activeClientId;
  // A user may reject a pending proposal or undo approved metadata after cancellation.
  const entitled=(parsed.action==="approve" || parsed.action==="change_destination") &&
    await hasOrganizerEntitlement(clientId);
  // Reject/undo remain possible after subscription expiry, not after global rollback.
  if(process.env.TAKATAK_AI_FILE_ORGANIZER_ENABLED!=="true")
    return jsonResponse({ok:false,code:"organizer_disabled"},503);
  const db=getPrisma();
  if(!db) return jsonResponse({ok:false,code:"unavailable"},503);
  try {
    const result=await db.$transaction(async tx=>{
      const record=await tx.organizerFilingProposal.findFirst({
        where:{id,clientId},select:{
          id:true,status:true,revision:true,clientId:true,sourceOutputId:true,
          sourceUpdatedAt:true,destinationProjectId:true,policyRevision:true,
        },
      });
      if(!record) return {ok:false as const,status:404,code:"not_found"};
      // Modify is an audited compare-and-swap of a PENDING metadata destination.
      // It cannot approve, modify originals, or bypass current source/consent checks.
      if(parsed.action==="change_destination"){
        if(record.revision!==parsed.expectedRevision)
          return {ok:false as const,status:409,code:"revision_conflict"};
        if(record.status!=="pending")
          return {ok:false as const,status:403,code:"transition_forbidden"};
        if(!entitled)
          return {ok:false as const,status:403,code:"entitlement_required"};
        if(parsed.destinationProjectId===record.destinationProjectId)
          return {ok:false as const,status:409,code:"destination_unchanged"};
        const [policyRow,source,target]=await Promise.all([
          tx.organizerWorkspacePolicy.findUnique({where:{clientId}}),
          tx.savedAiOutput.findFirst({where:{
            id:record.sourceOutputId,clientId,origin:"ai_generated",
            status:{in:["saved","draft","sent_to_approval"]},
            metadata:{path:["source"],equals:STUDIO_OUTPUT_SOURCE}},
            select:{updatedAt:true}}),
          tx.savedAiOutput.findFirst({where:{
            id:parsed.destinationProjectId,clientId,status:{not:"archived"},
            metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},
            select:{id:true}}),
        ]);
        const policy=organizerSettingsFromRow(policyRow);
        if(!source || !target || source.updatedAt.getTime()!==record.sourceUpdatedAt.getTime())
          return {ok:false as const,status:403,code:"source_or_destination_changed"};
        if(policy.mode!=="suggest" || !policy.consentGranted || policy.providerProcessingConsent ||
          !policy.requireApproval || policy.revision!==record.policyRevision ||
          !policy.allowedSourceKinds.includes("studio") ||
          !policy.allowedDestinationIds.includes(parsed.destinationProjectId))
          return {ok:false as const,status:403,code:"organizer_disabled"};
        const changed=await tx.organizerFilingProposal.updateMany({
          where:{id,clientId,status:"pending",revision:record.revision},
          data:{destinationProjectId:parsed.destinationProjectId,revision:{increment:1}},
        });
        if(changed.count!==1) return {ok:false as const,status:409,code:"revision_conflict"};
        await tx.auditLog.create({data:{
          clientId,profileId:gate.access.profileId,
          action:"organizer.filing_destination_changed",
          entityType:"organizer_filing_proposal",entityId:id,
          metadata:{revision:record.revision+1,sourceOutputId:record.sourceOutputId,
            fromDestinationProjectId:record.destinationProjectId,
            toDestinationProjectId:parsed.destinationProjectId,
            approved:false,originalChanged:false,providerCalled:false,fileMoved:false},
        }});
        return {ok:true as const,status:"pending",revision:record.revision+1};
      }
      let current=false,permitted=false;
      if(parsed.action==="approve" && entitled){
        const [policyRow,source,target]=await Promise.all([
          tx.organizerWorkspacePolicy.findUnique({where:{clientId}}),
          tx.savedAiOutput.findFirst({where:{
            id:record.sourceOutputId,clientId,origin:"ai_generated",
            status:{in:["saved","draft","sent_to_approval"]},
            metadata:{path:["source"],equals:STUDIO_OUTPUT_SOURCE}},
            select:{updatedAt:true}}),
          tx.savedAiOutput.findFirst({where:{
            id:record.destinationProjectId,clientId,status:{not:"archived"},
            metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},
            select:{id:true}}),
        ]);
        const policy=organizerSettingsFromRow(policyRow);
        current=Boolean(source && target && source.updatedAt.getTime()===record.sourceUpdatedAt.getTime());
        permitted=Boolean(entitled && policy.mode==="suggest" && policy.consentGranted &&
          !policy.providerProcessingConsent && policy.requireApproval &&
          policy.revision===record.policyRevision &&
          policy.allowedSourceKinds.includes("studio") &&
          policy.allowedDestinationIds.includes(record.destinationProjectId));
      }
      const transition=decideFilingTransition({
        currentStatus:record.status as FilingStatus,action:parsed.action,
        actualRevision:record.revision,expectedRevision:parsed.expectedRevision,
        sourceStillCurrent:current,enabledAndEntitled:permitted,
      });
      if(!transition.ok) return {ok:false as const,status:
        transition.code==="revision_conflict" ? 409 : 403,code:transition.code};
      const now=new Date();
      const next=await tx.organizerFilingProposal.updateMany({
        where:{id,clientId,status:record.status,revision:record.revision},
        data:{
          status:transition.status,revision:{increment:1},
          reviewedBy:gate.access.profileId,
          ...(transition.status==="undone"?{undoneAt:now}:{reviewedAt:now}),
        },
      });
      if(next.count!==1) return {ok:false as const,status:409,code:"revision_conflict"};
      await tx.auditLog.create({data:{
        clientId,profileId:gate.access.profileId,
        action:"organizer.filing_"+transition.status,
        entityType:"organizer_filing_proposal",entityId:id,
        metadata:{revision:record.revision+1,
          sourceOutputId:record.sourceOutputId,
          destinationProjectId:record.destinationProjectId,
          originalChanged:false,providerCalled:false},
      }});
      return {ok:true as const,status:transition.status,revision:record.revision+1};
    });
    if(!result.ok) return jsonResponse({ok:false,code:result.code},result.status);
    return jsonResponse({ok:true,status:result.status,revision:result.revision,
      originalChanged:false,providerCalled:false},200);
  }catch(e){
    if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002")
      return jsonResponse({ok:false,code:"assignment_conflict"},409);
    return handleApiError("organizer-filing-decision",e,"Filing decision unavailable.");
  }
}
