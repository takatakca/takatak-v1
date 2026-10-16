import Link from "next/link";
import { redirect } from "next/navigation";
import { requireGrowthAccess } from "@/lib/growth/access";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { listSeoManagedSites } from "@/lib/seo/seotakatak-bridge";
import { deleteSeoManagedSite, importSeoSearchConsoleQueries, registerSeoManagedSite } from "./actions";
import { googleServiceAccountConfigured } from "@/lib/integrations/google/client";

export const dynamic="force-dynamic";
export const metadata={title:"SEO Sites — TAKATAK",robots:{index:false,follow:false}};

export default async function SeoPortfolioPage({searchParams}:{searchParams:Promise<{result?:string}>}){
 const {access}=await requireGrowthAccess("/dashboard/seo/portfolio");
 if(access.mode!=="client_scoped")redirect("/dashboard/select-client?next=%2Fdashboard%2Fseo%2Fportfolio");
 const portfolio=await listSeoManagedSites();
 const canManage=hasEffectivePermission(access,"manage_integrations");
 const status=(await searchParams).result;
 const canImport=canManage&&hasEffectivePermission(access,"view_reports")&&googleServiceAccountConfigured();
 return <main className="space-y-6">
   <Link href="/dashboard/seo" className="text-sm font-semibold text-blue-700 hover:underline">← SEO dashboard</Link>
   <header className="rounded-3xl bg-gradient-to-r from-[#060D1F] to-[#145CCB] p-7 text-white">
    <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">SEOTAKATAK · TAKATAK Auth</p>
    <h1 className="mt-2 text-3xl font-extrabold">Managed SEO Sites</h1>
    <p className="mt-2 text-sm text-blue-100">Your active TAKATAK client workspace is the only source of site access. No separate SEO account is created.</p>
   </header>
   {status?<p role="status" className={"rounded-xl p-3 text-sm "+(["created","deleted"].includes(status)?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900")}>{status==="created"?"Website registered.":status==="deleted"?"Website and its SEO records permanently deleted from this workspace.":status==="invalid"?"Enter a valid domain, niche and market.":status==="unconfigured"?"SEOTAKATAK has not been configured by a platform operator.":status==="unauthorized"?"Your TAKATAK role cannot manage SEO sites.":status==="keywords_imported"?"Google Search Console queries imported successfully.":status==="google_not_linked"?"Link and verify this domain in TAKATAK Search Console first.":status==="google_no_data"?"Search Console returned no queries for the period.":status==="google_unavailable"?"Google Search Console is not available; no data imported.":status==="site_not_found"?"This site is not in your current workspace.":"SEO service unavailable. Try again later."}</p>:null}
   {portfolio.kind==="unconfigured"?<p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">The managed-site service is not connected yet. The free SEO tools remain available. An operator must configure the separate SEOTAKATAK API and approved database.</p>:null}
   {portfolio.kind==="unavailable"?<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The SEOTAKATAK service did not return verified data. No site metrics are shown.</p>:null}
   {portfolio.kind==="unauthorized"?<p className="rounded-xl border p-4 text-sm text-slate-700">Portfolio access requires an authorized TAKATAK client workspace.</p>:null}
   {portfolio.kind==="ready"?<section className="space-y-3">
     <h2 className="text-lg font-bold text-slate-950">Registered websites ({portfolio.sites.length})</h2>
     {!portfolio.sites.length?<p className="rounded-xl border bg-white p-4 text-sm text-slate-600">No websites registered in this client workspace.</p>:null}
     <div className="grid gap-3 md:grid-cols-2">{portfolio.sites.map(site=><div key={site.id} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="font-semibold text-slate-950">{site.domain}</p><p className="mt-1 text-sm text-slate-600">{site.niche} · {site.market} · {site.locale}</p>
     {hasEffectivePermission(access,"view_reports")?<Link href={"/dashboard/seo/portfolio/"+site.id} className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline">View evidence summary & CSV →</Link>:null}
      {canManage?<details className="mt-4 rounded-xl border border-red-200 p-3 text-xs">
       <summary className="cursor-pointer font-semibold text-red-800">Remove this SEO site</summary>
       <p className="mt-2 text-red-900">Permanently deletes this site's SEO opportunities, editorial prospects and drafts. Your TAKATAK account and customer record are not deleted.</p>
       <form action={deleteSeoManagedSite} className="mt-3 space-y-3">
        <input type="hidden" name="siteId" value={site.id}/>
        <label className="block font-medium text-slate-700">Type the exact domain to confirm:
          <input name="confirmDomain" required autoComplete="off" placeholder={site.domain} maxLength={253} className="mt-1 block w-full rounded-lg border border-red-200 p-2 text-sm"/>
        </label>
        <label className="flex items-start gap-2 text-red-900">
          <input type="checkbox" name="approveDeletion" value="yes" required className="mt-0.5"/>
          <span>I understand that these SEO records will be permanently deleted.</span>
        </label>
        <button type="submit" className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white">Permanently delete SEO site</button>
       </form>
      </details>:null}
      {canImport?<form action={importSeoSearchConsoleQueries} className="mt-3">
        <input type="hidden" name="siteId" value={site.id}/>
        <button type="submit" className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">Import real Google Search Console queries</button>
      </form>:<p className="mt-3 text-xs text-slate-500">Google keyword import requires report permission and a configured Search Console connector.</p>}
    </div>)}</div>
    </section>:null}
   {canManage&&portfolio.kind==="ready"?<section className="rounded-2xl border bg-white p-6">
    <h2 className="text-lg font-bold text-slate-950">Register a site</h2>
    <p className="mt-1 text-sm text-slate-600">Site registration does not verify ownership or enable automatic publishing. Ownership verification will be required before publishing.</p>
    <form action={registerSeoManagedSite} className="mt-4 grid gap-3 sm:grid-cols-2">
     <label className="text-xs font-semibold text-slate-700">Domain<input name="domain" required maxLength={253} placeholder="example.ca" className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
     <label className="text-xs font-semibold text-slate-700">Niche<input name="niche" required maxLength={120} placeholder="Local restaurant" className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
     <label className="text-xs font-semibold text-slate-700">Target market<input name="market" required maxLength={80} placeholder="Montreal, Canada" className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
     <label className="text-xs font-semibold text-slate-700">Locale<select name="locale" defaultValue="en-CA" className="mt-1 w-full rounded-xl border p-3 text-sm"><option value="en-CA">English (Canada)</option><option value="fr-CA">Français (Canada)</option><option value="es">Español</option></select></label>
     <button className="rounded-xl bg-blue-700 p-3 text-sm font-semibold text-white hover:bg-blue-800 sm:col-span-2" type="submit">Add website to this workspace</button>
    </form>
   </section>:null}
   <Link href="/dashboard/seo/free-tools" className="inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">Open free SEO & AI tools →</Link>
 </main>;
}
