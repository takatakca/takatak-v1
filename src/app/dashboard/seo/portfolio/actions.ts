"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addSeoManagedSite } from "@/lib/seo/seotakatak-bridge";

export async function registerSeoManagedSite(formData:FormData){
 const domain=String(formData.get("domain")??"").trim();
 const niche=String(formData.get("niche")??"").trim();
 const market=String(formData.get("market")??"").trim();
 const locale=String(formData.get("locale")??"en-CA");
 const result=await addSeoManagedSite({domain,niche,market,locale});
 if(result==="created")revalidatePath("/dashboard/seo/portfolio");
 redirect("/dashboard/seo/portfolio?result="+encodeURIComponent(result));
}
