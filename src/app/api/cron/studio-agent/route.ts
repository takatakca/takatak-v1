import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/security/api-response";
import { isServiceError } from "@/lib/services/service-error";
import { runStudioAgentTick } from "@/lib/studio/agent-service";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
/**
 * Scheduler entry point. Schedulers call GET; POST stays for manual/legacy
 * triggers. Both require the exact `Authorization: Bearer <CRON_SECRET>`.
 */
function authorized(request:NextRequest):boolean{
 const expected=process.env.CRON_SECRET?.trim()??"";const actual=request.headers.get("authorization")??"";const wanted=`Bearer ${expected}`;
 const supplied=Buffer.from(actual);const required=Buffer.from(wanted);
 return expected.length>=20&&supplied.length===required.length&&timingSafeEqual(supplied,required);
}
async function handle(request:NextRequest){
 if(!authorized(request))return jsonResponse({ok:false},401);
 try{return jsonResponse({ok:true,...await runStudioAgentTick()},200);}
 catch(error){
  // Category only: never the message, which can carry provider or storage detail.
  const category=isServiceError(error)?`service:${error.code}`:error instanceof Error?`error:${error.name}`:"unknown";
  console.error(`[cron:studio-agent] tick failed (${category})`);
  return jsonResponse({ok:false,code:"unavailable",category},503);
 }
}
export const GET=handle;
export const POST=handle;
