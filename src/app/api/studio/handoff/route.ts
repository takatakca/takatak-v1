import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse,handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { assertClientCanUseApprovals } from "@/lib/billing/social/entitlement-gates";
import { studioEnabled,STUDIO_OUTPUT_SOURCE } from "@/lib/studio/production";
import { canHandoff } from "@/lib/studio/agent-policy";
import { studioRecordId } from "@/lib/studio/agent-service";
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
  const account=await db.socialAccount.findFirst({where:{id:raw.accountId,clientId,status:"connected"},select:{id:true,clientId:true,businessBrandId:true,platform:true,status:true}});
  const output=await db.savedAiOutput.findFirst({where:{id:raw.outputId,clientId,metadata:{path:["source"],equals:STUDIO_OUTPUT_SOURCE}},select:{id:true,clientId:true,businessBrandId:true,content:true,metadata:true,status:true}});
  const meta=output?.metadata as Record<string,unknown>|null;
  if(!account||!output||!canHandoff({track:meta?.track,outputClientId:output.clientId,accountClientId:account.clientId,clientId,outputStatus:output.status,accountStatus:account.status,platform:account.platform,content:output.content})||output.businessBrandId&&output.businessBrandId!==account.businessBrandId)return jsonResponse({ok:false,code:"handoff_unavailable"},403);
  const postId=studioRecordId(`${clientId}:${output.id}:${account.id}:social-post`);
  const result=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM saved_ai_outputs WHERE id=${output.id}::uuid AND "clientId"=${clientId}::uuid FOR UPDATE`;
   const existing=await tx.socialPost.findFirst({where:{id:postId,clientId},select:{id:true}});if(existing)return {id:existing.id,replayed:true};
   const fresh=await tx.savedAiOutput.findFirst({where:{id:output.id,clientId,status:{in:["draft","saved","sent_to_approval"]}},select:{businessBrandId:true,content:true,metadata:true}});
   if(!fresh||fresh.businessBrandId&&fresh.businessBrandId!==account.businessBrandId)throw Error("output_changed");
   await tx.socialPost.create({data:{id:postId,clientId,businessBrandId:account.businessBrandId,socialAccountId:account.id,platform:account.platform,caption:fresh.content,status:"pending_approval",metadata:{source:"takatakstudio",savedOutputId:output.id,projectId:String(meta?.projectId??"")}}});
   const approval=await tx.approval.create({data:{clientId,businessBrandId:account.businessBrandId,socialPostId:postId,requestedByProfileId:gate.access.profileId,status:"pending",comments:"TAKATAKSTUDIO social draft — account selected by workspace operator."},select:{id:true}});
   const current=(fresh.metadata??{}) as Prisma.InputJsonObject;
   await tx.savedAiOutput.update({where:{id:output.id},data:{status:"sent_to_approval",businessBrandId:account.businessBrandId,metadata:{...current,socialPostId:typeof current.socialPostId==="string"?current.socialPostId:postId,approvalId:typeof current.approvalId==="string"?current.approvalId:approval.id}}});
   return {id:postId,replayed:false};
  });
  return jsonResponse({ok:true,...result,status:"pending_approval",published:false},200);
 }catch(e){return handleApiError("studio-handoff",e,"The draft could not be sent to review.");}
}
