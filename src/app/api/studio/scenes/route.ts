import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse,handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { studioEnabled,STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";
import { parseScenes,STUDIO_SCENE_SOURCE } from "@/lib/studio/agent-policy";
import { studioRecordId } from "@/lib/studio/agent-service";
export const dynamic="force-dynamic";export const runtime="nodejs";
export async function POST(request:NextRequest){
 const gate=await requireWorkspaceApiPermission("create_content");if(!gate.ok)return gate.response;
 if(!studioEnabled(process.env))return jsonResponse({ok:false,code:"studio_disabled"},503);
 const parsed=await readJsonBody(request,16384);if(!parsed.ok)return jsonResponse({ok:false,message:parsed.message},parsed.status);
 const raw=parsed.body as {projectId?:unknown;scenes?:unknown;revision?:unknown};
 const scenes=parseScenes(raw?.scenes);if(typeof raw?.projectId!=="string"||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(raw.projectId)||!scenes||!Number.isSafeInteger(raw.revision)||Number(raw.revision)<0)return jsonResponse({ok:false,code:"invalid_scenes"},400);
 const db=getPrisma();if(!db)return jsonResponse({ok:false},503);
 try{
  const project=await db.savedAiOutput.findFirst({where:{id:raw.projectId,clientId:gate.access.activeClientId,status:{not:"archived"},metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},select:{id:true,title:true}});if(!project)return jsonResponse({ok:false},404);
  const id=studioRecordId(`${gate.access.activeClientId}:${project.id}:scenes`);const next=Number(raw.revision)+1;
  const metadata={source:STUDIO_SCENE_SOURCE,projectId:project.id,revision:next};
  if(raw.revision===0){try{await db.savedAiOutput.create({data:{id,clientId:gate.access.activeClientId,kind:"creative_brief",title:`Scenes · ${project.title}`,content:JSON.stringify(scenes),origin:"manual",status:"draft",metadata}});}catch(e){if((e as {code?:string}).code==="P2002")return jsonResponse({ok:false,message:"A scene plan was saved elsewhere. Reload before editing."},409);throw e;}}
  else{const saved=await db.savedAiOutput.updateMany({where:{id,clientId:gate.access.activeClientId,metadata:{path:["revision"],equals:Number(raw.revision)}},data:{content:JSON.stringify(scenes),metadata}});if(saved.count!==1)return jsonResponse({ok:false,message:"The scene plan changed. Reload before saving."},409);}
  return jsonResponse({ok:true,revision:next},200);
 }catch(e){return handleApiError("studio-scenes",e,"The scene plan could not be saved.");}
}
