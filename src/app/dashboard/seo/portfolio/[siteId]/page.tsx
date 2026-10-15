import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireGrowthAccess } from "@/lib/growth/access";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { listSeoManagedSites, getSeoEvidenceSummary } from "@/lib/seo/seotakatak-bridge";
export const dynamic="force-dynamic";
export const metadata={title:"SEO Evidence — TAKATAK",robots:{index:false,follow:false}};

export default async function SeoEvidencePage({params}:{params:Promise<{siteId:string}>}){
 const {access}=await requireGrowthAccess("/dashboard/seo/portfolio");
 if(access.mode!=="client_scoped")redirect("/dashboard/select-client?next=%2Fdashboard%2Fseo%2Fportfolio");
 if(!hasEffectivePermission(access,"view_reports"))redirect("/dashboard/seo/portfolio");
 const {siteId}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(siteId))notFound();
 const portfolio=await listSeoManagedSites();
 const site=portfolio.kind==="ready"?portfolio.sites.find(s=>s.id===siteId):null;
 if(!site)notFound();
 const report=await getSeoEvidenceSummary(siteId);
 return <main className="space-y-5">
  <Link href="/dashboard/seo/portfolio" className="text-sm font-semibold text-blue-700 hover:underline">← Managed SEO sites</Link>
  <header className="rounded-2xl bg-gradient-to-r from-[#060D1F] to-[#145CCB] p-6 text-white">
   <p className="text-xs uppercase tracking-wider text-cyan-200">SEOTAKATAK · verified workspace scope</p>
   <h1 className="mt-2 text-2xl font-bold">{site.domain}</h1>
   <p className="mt-1 text-sm text-blue-100">{site.niche} · {site.market}</p>
  </header>
  {report.kind!=="ready"?<p role="status" className="rounded-xl border bg-amber-50 p-4 text-sm text-amber-900">The SEOTAKATAK reporting service is not available for this workspace. No metrics have been invented.</p>:<section className="space-y-4">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {[
     {name:"Keywords sampled",value:report.summary.opportunitiesSampled},
     {name:"Clicks in sample",value:report.summary.clicksInSample},
     {name:"Backlink prospects sampled",value:report.summary.prospectsSampled},
     {name:"Content briefs sampled",value:report.summary.briefsSampled}
    ].map(item=><div key={item.name} className="rounded-2xl border bg-white p-5"><p className="text-xs text-slate-500">{item.name}</p><p className="mt-2 text-2xl font-bold text-slate-950">{item.value.toLocaleString("en-CA")}</p></div>)}
   </div>
   <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
    <p className="font-semibold">Evidence and limitations</p>
    <p className="mt-1">{report.summary.note}</p>
    <p className="mt-1">Source: {report.summary.source}. No current search rankings, complete totals or AI citations are claimed. Verified backlinks: provider not connected.</p>
   </div>
   <Link href={"/api/seo/sites/"+site.id+"/opportunities.csv"} className="inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">Download keyword sample (CSV) →</Link>
  </section>}
 </main>;
}
