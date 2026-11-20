import { NextResponse } from "next/server";
import {timingSafeEqual} from "node:crypto";
import {readKnowledgeAiIssuerConfig,signKnowledgeAiToken} from "@/lib/integrations/knowledgeai/issuer";
import {isKnowledgeAiScope} from "@/lib/integrations/knowledgeai/policy";
import {resolveKnowledgeAiTokenAuthority} from "@/lib/integrations/knowledgeai/authority";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const deny=(status:number)=>NextResponse.json({error:status===503?
  "Service unavailable":"Forbidden"},{
  status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
function internalCallerAuthorized(value:string|null):boolean {
  const expected=process.env.KNOWLEDGEAI_EXCHANGE_SECRET||"";
  if (!value || expected.length<32) return false;
  const received=Buffer.from(value,"utf8"), secret=Buffer.from(expected,"utf8");
  return received.length===secret.length && timingSafeEqual(received,secret);
}
export async function POST(request:Request):Promise<NextResponse> {
  const config=readKnowledgeAiIssuerConfig();
  if (!config) return deny(503);
  // The token is returned only to an explicitly authenticated TAKATAK
  // server-side consumer that also carries a verified user session.
  if (!internalCallerAuthorized(request.headers.get("x-takatak-knowledgeai-secret")))
    return deny(403);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return deny(403);
  let body:unknown;
  try {body=await request.json();}catch{return deny(403);}
  const scope=(body&&typeof body==="object"&&
    !Array.isArray(body))?(body as {scope?:unknown}).scope:undefined;
  if (!isKnowledgeAiScope(scope)) return deny(403);
  const grant=await resolveKnowledgeAiTokenAuthority(scope);
  if (!grant) return deny(403);
  try {
    const token=signKnowledgeAiToken(config,{...grant,scope});
    return NextResponse.json({token,token_type:"Bearer",expires_in:60},{
      headers:{"Cache-Control":"no-store","Pragma":"no-cache",
        "X-Content-Type-Options":"nosniff"}
    });
  }catch{return deny(503);}
}
