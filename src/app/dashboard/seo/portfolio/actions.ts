"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addSeoManagedSite, importVerifiedSeoQueries, listSeoManagedSites } from "@/lib/seo/seotakatak-bridge";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { listGoogleLinkedSites } from "@/lib/analytics/service";
import { fetchSearchQueries } from "@/lib/integrations/google/client";

export async function registerSeoManagedSite(formData:FormData){
 const domain=String(formData.get("domain")??"").trim();
 const niche=String(formData.get("niche")??"").trim();
 const market=String(formData.get("market")??"").trim();
 const locale=String(formData.get("locale")??"en-CA");
 const result=await addSeoManagedSite({domain,niche,market,locale});
 if(result==="created")revalidatePath("/dashboard/seo/portfolio");
 redirect("/dashboard/seo/portfolio?result="+encodeURIComponent(result));
}

/** Server-only Search Console import: linked property, active workspace and permissions are rechecked here. */
export async function importSeoSearchConsoleQueries(formData:FormData){
 const id=String(formData.get("siteId")??"");
 const base="/dashboard/seo/portfolio";
 const {access}=await getServerAccessContext();
 if(access.mode!=="client_scoped"||!hasEffectivePermission(access,"manage_integrations")||
    !hasEffectivePermission(access,"view_reports"))redirect(base+"?result=unauthorized");
 const sites=await listSeoManagedSites();
 const site=sites.kind==="ready"?sites.sites.find(s=>s.id===id):null;
 if(!site)redirect(base+"?result=site_not_found");
 let status="unavailable";
 try {
   const verifiedSites=(await listGoogleLinkedSites(access.activeClientId)).filter(s=>Boolean(s.searchConsoleProperty));
   const hostname=(host:string)=>host.toLowerCase().replace(/^www\./,"").replace(/\.$/,"");
   const linked=verifiedSites.find(s=>hostname(s.domain)===hostname(site.domain)&&s.searchConsoleProperty);
   if(!linked?.searchConsoleProperty)status="google_not_linked";
   else {
     const response=await fetchSearchQueries(linked.searchConsoleProperty,28,100);
     if(!response.ok)status="google_unavailable";
     else if(response.data.length===0)status="google_no_data";
     else {
       const rows=response.data.map(row=>({
         keyword:row.query,clicks:row.clicks,impressions:row.impressions,position:row.position
       }));
       const saved=await importVerifiedSeoQueries(site.id,rows);
       status=saved.kind==="imported"?"keywords_imported":saved.kind;
     }
   }
 }catch{status="google_unavailable";}
 if(status==="keywords_imported")revalidatePath(base);
 redirect(base+"?result="+encodeURIComponent(status));
}
