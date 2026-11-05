import type { NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse,handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { studioEnabled,STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";
import { parseScenes,STUDIO_SCENE_SOURCE } from "@/lib/studio/agent-policy";
import { studioRecordId } from "@/lib/studio/agent-service";
import { saveStudioScenes } from "@/lib/studio/scene-service";
export const dynamic="force-dynamic";export const runtime="nodejs";
export async function GET(request:NextRequest){
 const gate=await requireWorkspaceApiPermission("create_content");if(!gate.ok)return gate.response;
 if(!studioEnabled(process.env))return jsonResponse({ok:false,code:"studio_disabled"},503);
 const projectId=request.nextUrl.searchParams.get("projectId");
 if(!projectId||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(projectId))return jsonResponse({ok:false,code:"invalid_project"},400);
 const db=getPrisma();if(!db)return jsonResponse({ok:false},503);
 try{
  const clientId=gate.access.activeClientId;
  const project=await db.savedAiOutput.findFirst({where:{id:projectId,clientId,status:{not:"archived"},metadata:{path:["source"],equals:STUDIO_PROJECT_SOURCE}},select:{id:true}});
  if(!project)return jsonResponse({ok:false,code:"project_not_found"},404);
  const plan=await db.savedAiOutput.findFirst({where:{id:studioRecordId(`${clientId}:${project.id}:scenes`),clientId,status:{not:"archived"},metadata:{path:["source"],equals:STUDIO_SCENE_SOURCE}},select:{content:true,metadata:true}});
  return jsonResponse({ok:true,plan},200);
 }catch(e){return handleApiError("studio-scenes-read",e,"The scene plan could not be loaded.");}
}
export async function POST(request:NextRequest){
 const gate=await requireWorkspaceApiPermission("create_content");if(!gate.ok)return gate.response;
 if(!studioEnabled(process.env))return jsonResponse({ok:false,code:"studio_disabled"},503);
 const parsed=await readJsonBody(request,16384);if(!parsed.ok)return jsonResponse({ok:false,message:parsed.message},parsed.status);
 const raw=parsed.body as {projectId?:unknown;scenes?:unknown;revision?:unknown};
 const scenes=parseScenes(raw?.scenes);if(typeof raw?.projectId!=="string"||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(raw.projectId)||!scenes||!Number.isSafeInteger(raw.revision)||Number(raw.revision)<0||Number(raw.revision)>=Number.MAX_SAFE_INTEGER)return jsonResponse({ok:false,code:"invalid_scenes"},400);
 const db=getPrisma();if(!db)return jsonResponse({ok:false},503);
 try{
  const result=await db.$transaction(tx=>saveStudioScenes(tx,{clientId:gate.access.activeClientId,projectId:raw.projectId as string,scenes,revision:Number(raw.revision)},{projectSource:STUDIO_PROJECT_SOURCE,sceneSource:STUDIO_SCENE_SOURCE,recordId:studioRecordId}));
  const {statusCode,...body}=result;
  return jsonResponse(body,statusCode);
 }catch(e){return handleApiError("studio-scenes",e,"The scene plan could not be saved.");}
}
