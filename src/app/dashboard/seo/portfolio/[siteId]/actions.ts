"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addSeoProspect, updateSeoProspectStatus, manageSeoDomainVerification, addSeoContentBrief } from "@/lib/seo/seotakatak-bridge";
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

export async function changeSeoDomainVerification(formData:FormData){
 const siteId=String(formData.get("siteId")??"");
 const action=String(formData.get("action")??"");
 if(!SITE_ID.test(siteId)||!["start","check"].includes(action))
  redirect("/dashboard/seo/portfolio?result=invalid");
 const result=await manageSeoDomainVerification(siteId,action as "start"|"check");
 if(result==="verified"||result==="challenge_created")
  revalidatePath("/dashboard/seo/portfolio/"+siteId);
 redirect("/dashboard/seo/portfolio/"+siteId+"?verification="+encodeURIComponent(result));
}

export async function createSeoContentBrief(formData:FormData){
 const siteId=String(formData.get("siteId")??"");
 if(!SITE_ID.test(siteId))redirect("/dashboard/seo/portfolio?result=invalid");
 const result=await addSeoContentBrief({
  siteId,keyword:String(formData.get("keyword")??"").trim(),
  angle:String(formData.get("angle")??"").trim()
 });
 if(result==="created")revalidatePath("/dashboard/seo/portfolio/"+siteId);
 redirect("/dashboard/seo/portfolio/"+siteId+"?brief="+encodeURIComponent(result));
}
