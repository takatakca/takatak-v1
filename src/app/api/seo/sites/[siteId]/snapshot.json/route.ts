import { NextResponse } from "next/server";
import { downloadSeoSiteSnapshot } from "@/lib/seo/seotakatak-bridge";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(_request:Request,{params}:{params:Promise<{siteId:string}>}){
 const {siteId}=await params;
 const snapshot=await downloadSeoSiteSnapshot(siteId);
 if(snapshot.kind!=="ready"){
  const status=snapshot.kind==="unauthorized"?403:snapshot.kind==="unconfigured"?503:404;
  return NextResponse.json({ok:false,error:snapshot.kind},{status,headers:{"Cache-Control":"no-store"}});
 }
 return new Response(snapshot.json,{status:200,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Content-Disposition":'attachment; filename="seotakatak-site-'+siteId+'.json"',
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"
 }});
}
