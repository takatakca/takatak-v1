import { NextRequest, NextResponse } from "next/server";
import { isTrustedRequestOrigin } from "@/lib/auth/trusted-origin";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  clientCanRequestKnowledgeAI, getKnowledgeAIConfig,
  hasLiveKnowledgeAIGrant, signKnowledgeAIJWT,
} from "@/lib/integrations/knowledgeai/issuer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status: number): NextResponse {
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
  }});
}
async function readLimited(request:NextRequest,max:number):Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new Error("Invalid content type");
  const reader=request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks:Uint8Array[]=[];
  let length=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      length+=value.byteLength;
      if (length>max) {
        await reader.cancel();
        throw new Error("Request too large");
      }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
async function parseLimitedResponse(response:Response,max:number):Promise<unknown> {
  const reader=response.body?.getReader();
  if (!reader) throw new Error("No private response");
  const chunks:Uint8Array[]=[];
  let length=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      length+=value.byteLength;
      if (length>max) {
        await reader.cancel();
        throw new Error("Oversized private response");
      }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

/** Browser receives scoped results only. Private JWT never leaves TAKATAK. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const config=getKnowledgeAIConfig();
  if (!config) return json({ok:false,error:"Unavailable"},503);
  if (!isTrustedRequestOrigin(request)) return json({ok:false,error:"Forbidden"},403);
  let body:unknown;
  try {body=await readLimited(request,2048);}
  catch {return json({ok:false,error:"Invalid request"},400);}
  if (!body || typeof body!=="object" || Array.isArray(body))
    return json({ok:false,error:"Invalid request"},400);
  const input=body as Record<string,unknown>;
  const limit=input.limit===undefined?20:input.limit;
  if (Object.keys(input).some(key=>key!=="q" && key!=="limit") ||
      typeof input.q!=="string" || input.q.length>200 ||
      typeof limit!=="number" || !Number.isInteger(limit) ||
      limit<1 || limit>20) return json({ok:false,error:"Invalid request"},400);

  const {access}=await getServerAccessContext();
  if (!clientCanRequestKnowledgeAI(access,"knowledge:read"))
    return json({ok:false,error:"Forbidden"},403);
  if (!await hasLiveKnowledgeAIGrant(access.activeClientId,
      access.profileId,"knowledge:read"))
    return json({ok:false,error:"Forbidden"},403);

  const bearer=signKnowledgeAIJWT(config,{
    profileId:access.profileId,workspaceId:access.activeClientId,
    scope:"knowledge:read"
  });
  const url=new URL("/v1/knowledge/search",config.privateOrigin);
  url.searchParams.set("q",input.q);
  url.searchParams.set("limit",String(limit));
  try {
    const upstream=await fetch(url,{
      method:"GET",headers:{Authorization:"Bearer "+bearer,Accept:"application/json"},
      cache:"no-store",redirect:"error",signal:AbortSignal.timeout(6000)
    });
    if (!upstream.ok) {
      const code=upstream.status===429?429:upstream.status===403?403:
        upstream.status===401?401:503;
      return json({ok:false,error:code===429?"Rate limit exceeded":"Unavailable"},code);
    }
    const payload=await parseLimitedResponse(upstream,262144);
    if (!payload || typeof payload!=="object" ||
        (payload as {visibility?:unknown}).visibility!=="private" ||
        !Array.isArray((payload as {results?:unknown}).results))
      throw new Error("Invalid backend reply");
    return json({ok:true,data:payload as Record<string,unknown>},200);
  } catch {return json({ok:false,error:"Unavailable"},503);}
}
