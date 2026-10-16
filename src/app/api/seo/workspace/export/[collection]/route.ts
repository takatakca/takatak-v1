import { NextResponse } from "next/server";
import { getSeoWorkspaceExportPage, type SeoExportCollection } from "@/lib/seo/seotakatak-bridge";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const collections:SeoExportCollection[]=["sites","opportunities","prospects","briefs"];

export async function GET(request:Request,{params}:{params:Promise<{collection:string}>}){
 const {collection}=await params;
 const search=new URL(request.url).searchParams;
 const offsetText=search.get("offset")??"0";
 if(!collections.includes(collection as SeoExportCollection)||
    !/^(0|[1-9][0-9]{0,6})$/.test(offsetText)||Number(offsetText)>1_000_000)
  return NextResponse.json({ok:false,error:"invalid_export_page"},{status:400,headers:{"Cache-Control":"no-store"}});
 const result=await getSeoWorkspaceExportPage(collection as SeoExportCollection,Number(offsetText));
 if(result.kind!=="ready"){
  const status=result.kind==="unauthorized"?403:result.kind==="unconfigured"?503:404;
  return NextResponse.json({ok:false,error:result.kind},{status,headers:{"Cache-Control":"no-store"}});
 }
 return new Response(result.json,{status:200,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Content-Disposition":'attachment; filename="seotakatak-'+collection+'-'+offsetText+'.json"',
  "Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"
 }});
}
