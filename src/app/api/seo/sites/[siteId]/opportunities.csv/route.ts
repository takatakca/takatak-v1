import { NextResponse } from "next/server";
import { downloadSeoOpportunities } from "@/lib/seo/seotakatak-bridge";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{siteId:string}>}){
 const {siteId}=await params;
 const data=await downloadSeoOpportunities(siteId);
 if(data.kind!=="ready"){
  const status=data.kind==="unauthorized"?403:data.kind==="unconfigured"?503:404;
  return NextResponse.json({ok:false,error:data.kind},{status,headers:{"Cache-Control":"no-store"}});
 }
 return new Response(data.csv,{status:200,headers:{
  "Content-Type":"text/csv; charset=utf-8",
  "Content-Disposition":'attachment; filename="seo-keywords-'+siteId+'.csv"',
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"
 }});
}
