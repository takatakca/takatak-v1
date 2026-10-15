"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addSeoProspect, updateSeoProspectStatus } from "@/lib/seo/seotakatak-bridge";
const SITE_ID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function destination(siteId:string,result:string){
 if(!SITE_ID.test(siteId))return "/dashboard/seo/portfolio?result=invalid";
 return "/dashboard/seo/portfolio/"+siteId+"?prospect="+encodeURIComponent(result);
}
export async function createBacklinkProspect(formData:FormData){
 const siteId=String(formData.get("siteId")??"");
 const result=await addSeoProspect({
  siteId,publication:String(formData.get("publication")??"").trim(),
  url:String(formData.get("url")??"").trim(),
  relevance:String(formData.get("relevance")??"").trim()
 });
 if(result==="created")revalidatePath("/dashboard/seo/portfolio/"+siteId);
 redirect(destination(siteId,result));
}
export async function changeBacklinkProspectStatus(formData:FormData){
 const siteId=String(formData.get("siteId")??"");
 const result=await updateSeoProspectStatus({
  siteId,prospectId:String(formData.get("prospectId")??""),
  status:String(formData.get("status")??"")
 });
 if(result==="updated")revalidatePath("/dashboard/seo/portfolio/"+siteId);
 redirect(destination(siteId,result));
}
