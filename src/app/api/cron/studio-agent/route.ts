import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/security/api-response";
import { runStudioAgentTick } from "@/lib/studio/agent-service";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
export async function POST(request:NextRequest){
 const expected=process.env.CRON_SECRET?.trim()??"";const actual=request.headers.get("authorization")??"";const wanted=`Bearer ${expected}`;
 const supplied=Buffer.from(actual);const required=Buffer.from(wanted);
 if(expected.length<20||supplied.length!==required.length||!timingSafeEqual(supplied,required))return jsonResponse({ok:false},401);
 try{return jsonResponse({ok:true,...await runStudioAgentTick()},200);}catch{return jsonResponse({ok:false,code:"unavailable"},503);}
}
