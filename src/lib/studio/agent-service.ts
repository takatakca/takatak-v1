import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { computeTenantAccess } from "@/lib/security/tenant-access";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { resolveMembershipBasePermissions } from "@/lib/security/role-permissions";
import type { Permission } from "@/lib/security/roles";
import { generateStudioDraft, STUDIO_PROJECT_SOURCE, studioEnabled } from "./production";
import { studioGenerationDependencies } from "./generation-dependencies";
import { STUDIO_AGENT_SOURCE, planSteps, type AgentPlan, type AgentTrack } from "./agent-policy";
import { creditsFor, takbotMode } from "@/lib/takbot/catalog";

export function studioRecordId(seed:string):string {
  const h=createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
export async function queueStudioPlan(clientId:string,actorId:string,plan:AgentPlan) {
  const db=getPrisma();if(!db)throw new ServiceError("unavailable","Studio is temporarily unavailable.");
  const project=await db.savedAiOutput.findFirst({where:{id:plan.projectId,clientId,status:{not:"archived"},metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},select:{id:true}});
  if(!project)throw new ServiceError("not_found","Production not found.");
  const operation=studioRecordId(`${clientId}:${plan.projectId}:${plan.requestId}`);
  const fingerprint=createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  const steps=planSteps(plan,Date.now());
  const mode=takbotMode("write");const price=mode?creditsFor(mode):0;
  return db.$transaction(async tx=>{
    // Serialize plan creation per production, including requests using different operation IDs.
    await tx.$queryRaw`SELECT id FROM saved_ai_outputs WHERE id=${project.id}::uuid AND "clientId"=${clientId}::uuid FOR UPDATE`;
    const existing=await tx.job.findFirst({where:{clientId,AND:[{metadata:{path:["source"],equals:STUDIO_AGENT_SOURCE}},{metadata:{path:["operation"],equals:operation}}]},select:{metadata:true}});
    if(existing){const m=existing.metadata as Record<string,unknown>;if(m.fingerprint!==fingerprint)throw new ServiceError("conflict","This request ID already belongs to another plan.");return {operation,replayed:true,count:steps.length};}
    const active=await tx.job.findFirst({where:{clientId,status:{in:["queued","running"]},AND:[{metadata:{path:["source"],equals:STUDIO_AGENT_SOURCE}},{metadata:{path:["projectId"],equals:project.id}}]},select:{id:true}});
    if(active)throw new ServiceError("conflict","This production already has an active agent plan.");
    for(const step of steps)await tx.job.create({data:{id:studioRecordId(`${operation}:${step.day}:${step.track}`),clientId,type:"generate_content",status:"queued",maxAttempts:1,scheduledFor:new Date(step.dueAt),metadata:{source:STUDIO_AGENT_SOURCE,version:1,operation,fingerprint,projectId:project.id,actorId,track:step.track,day:step.day,engine:plan.engine,creditCeiling:price,budgetCredits:plan.budgetCredits}}});
    return {operation,replayed:false,count:steps.length};
  });
}
async function actorAllowed(clientId:string,profileId:string) {
  const db=getPrisma();if(!db)return false;
  const profile=await db.profile.findUnique({where:{id:profileId},select:{id:true,role:true,status:true,memberships:{where:{clientId},select:{clientId:true,role:true,status:true,customPermissions:true,deniedPermissions:true,customRoleId:true,customRole:{select:{permissions:true}},client:{select:{status:true,rolePermissionOverrides:{select:{role:true,permissions:true}}}}}}}});
  const access=computeTenantAccess({runtime:{foundationAllowed:false,mode:"production"},authenticated:true,databaseAvailable:true,profile:profile?{id:profile.id,role:profile.role,status:profile.status}:null,requestedClientId:clientId,memberships:(profile?.memberships??[]).map(m=>({clientId:m.clientId,clientStatus:m.client.status,role:m.role,status:m.status,customPermissions:m.customPermissions as Permission[],deniedPermissions:m.deniedPermissions as Permission[],customRoleId:m.customRoleId,roleBasePermissions:resolveMembershipBasePermissions({role:m.role,customRolePermissions:m.customRole?.permissions as Permission[]|undefined,roleOverridePermissions:m.client.rolePermissionOverrides.find(o=>o.role===m.role)?.permissions as Permission[]|undefined})}))});
  return access.mode==="client_scoped" && access.activeClientId===clientId && hasEffectivePermission(access,"create_content");
}
/** One due step per tick. Running/ambiguous jobs are NEVER reclaimed automatically. */
export async function runStudioAgentTick() {
  if(!studioEnabled(process.env)||process.env.TAKATAK_STUDIO_AGENT_ENABLED!=="true")return {state:"disabled"};
  const db=getPrisma();if(!db)throw new ServiceError("unavailable","Studio is unavailable.");
  const job=await db.job.findFirst({where:{type:"generate_content",status:"queued",scheduledFor:{lte:new Date()},metadata:{path:["source"],equals:STUDIO_AGENT_SOURCE}},orderBy:{scheduledFor:"asc"}});
  if(!job?.clientId)return {state:"idle"};
  const lease=randomUUID();const claim=await db.job.updateMany({where:{id:job.id,clientId:job.clientId,status:"queued"},data:{status:"running",leaseOwner:lease,leaseExpiresAt:new Date(Date.now()+120000),startedAt:new Date(),attempts:{increment:1}}});
  if(claim.count!==1)return {state:"contended"};
  const m=job.metadata as Record<string,unknown>;
  try{
    if(typeof m.actorId!=="string"||!await actorAllowed(job.clientId,m.actorId))throw new ServiceError("forbidden","Agent authorization changed.");
    const mode=takbotMode("write");if(!mode||creditsFor(mode)!==m.creditCeiling)throw new ServiceError("forbidden","Credit price changed; review the plan.");
    const result=await generateStudioDraft(studioGenerationDependencies(db),job.clientId,{projectId:String(m.projectId),track:m.track as AgentTrack,requestId:job.id,engine:m.engine==="ollama"?"ollama":"auto"});
    if(!result.ok){await db.job.updateMany({where:{id:job.id,leaseOwner:lease,status:"running"},data:{status:"failed",errorMessage:result.code,completedAt:new Date(),leaseOwner:null,leaseExpiresAt:null}});return {state:"needs_attention"};}
    await db.job.updateMany({where:{id:job.id,leaseOwner:lease,status:"running"},data:{status:"completed",completedAt:new Date(),leaseOwner:null,leaseExpiresAt:null,metadata:{...m,outputId:result.savedId,linked:result.linked,published:false,...(!result.savedId?{recoveryText:result.text.slice(0,20000)}:{})}}});
    return {state:"draft_ready"};
  }catch{
    // The provider may have completed before storage failed. Never automatically replay.
    await db.job.updateMany({where:{id:job.id,leaseOwner:lease,status:"running"},data:{status:"failed",errorMessage:"requires_reconciliation",completedAt:new Date(),leaseOwner:null,leaseExpiresAt:null}});
    return {state:"needs_attention"};
  }
}
