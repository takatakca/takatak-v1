import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireGrowthAccess } from "@/lib/growth/access";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { listSeoManagedSites, getSeoEvidenceSummary, getSeoOpportunities, getSeoProspects, getSeoDomainVerification, getSeoContentBriefs } from "@/lib/seo/seotakatak-bridge";
import { createBacklinkProspect, changeBacklinkProspectStatus, changeSeoDomainVerification, createSeoContentBrief, reviewSeoContentBrief } from "./actions";
export const dynamic="force-dynamic";
export const metadata={title:"SEO Evidence — TAKATAK",robots:{index:false,follow:false}};

export default async function SeoEvidencePage({params,searchParams}:{params:Promise<{siteId:string}>;searchParams:Promise<{prospect?:string;verification?:string;brief?:string}>}){
 const {access}=await requireGrowthAccess("/dashboard/seo/portfolio");
 if(access.mode!=="client_scoped")redirect("/dashboard/select-client?next=%2Fdashboard%2Fseo%2Fportfolio");
 if(!hasEffectivePermission(access,"view_reports"))redirect("/dashboard/seo/portfolio");
 const {siteId}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(siteId))notFound();
 const portfolio=await listSeoManagedSites();
 const site=portfolio.kind==="ready"?portfolio.sites.find(s=>s.id===siteId):null;
 if(!site)notFound();
 const canManage=hasEffectivePermission(access,"manage_integrations");
 const [report,opportunities,prospects,verification,briefs]=await Promise.all([
  getSeoEvidenceSummary(siteId),getSeoOpportunities(siteId),getSeoProspects(siteId),
  canManage?getSeoDomainVerification(siteId):Promise.resolve(null),getSeoContentBriefs(siteId)
 ]);
 const messages=await searchParams;
 const prospectResult=messages.prospect;
 const verificationResult=messages.verification;
 const briefResult=messages.brief;
 return <main className="space-y-5">
  <Link href="/dashboard/seo/portfolio" className="text-sm font-semibold text-blue-700 hover:underline">← Managed SEO sites</Link>
  <header className="rounded-2xl bg-gradient-to-r from-[#060D1F] to-[#145CCB] p-6 text-white">
   <p className="text-xs uppercase tracking-wider text-cyan-200">SEOTAKATAK · verified workspace scope</p>
   <h1 className="mt-2 text-2xl font-bold">{site.domain}</h1>
   <p className="mt-1 text-sm text-blue-100">{site.niche} · {site.market}</p>
  </header>
  {canManage?<section className="space-y-3 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-bold text-slate-950">Verify domain ownership (DNS TXT)</h2>
    <p className="text-sm text-slate-600">Registration alone is not proof of ownership. Only a TAKATAK client manager may start or complete this independent verification. No publishing or site changes occur automatically.</p>
    {verificationResult?<p role="status" className={"rounded-xl p-3 text-sm "+(["verified","challenge_created"].includes(verificationResult)?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900")}>
      {verificationResult==="verified"?"Domain ownership confirmed from live DNS.":
       verificationResult==="challenge_created"?"A new TXT challenge has been generated. Publish it at your DNS provider before checking.":
       verificationResult==="unauthorized"?"This workspace cannot manage domain verification.":
       verificationResult==="unconfigured"?"SEOTAKATAK is not configured for DNS ownership verification.":
       "Ownership is not verified yet. Confirm the TXT record has propagated, or try again later."}
    </p>:null}
    {verification?.kind==="ready"?<>
      <p className={"text-sm font-semibold "+(verification.verification.verified?"text-emerald-700":"text-amber-700")}>
        {verification.verification.verified?"Verified domain":"Unverified domain"}
        {verification.verification.verifiedAt?" · "+verification.verification.verifiedAt:""}
      </p>
      {verification.verification.challenge&&!verification.verification.verified?<div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-semibold uppercase text-blue-900">Create this DNS TXT record</p>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-blue-800">Host / name</dt><dd className="break-all font-mono text-blue-950">{verification.verification.challenge.recordName}</dd></div>
          <div><dt className="text-xs text-blue-800">TXT record value</dt><dd className="break-all font-mono text-blue-950">{verification.verification.challenge.recordValue}</dd></div>
        </dl>
        <p className="text-xs text-blue-900">Challenges expire after seven days. Creating another challenge invalidates the previous one. DNS propagation may take time.</p>
      </div>:null}
      <div className="flex flex-wrap gap-2">
        <form action={changeSeoDomainVerification}>
          <input type="hidden" name="siteId" value={site.id}/>
          <input type="hidden" name="action" value="start"/>
          <button type="submit" className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">{verification.verification.challenge?"Replace TXT challenge":"Generate DNS TXT challenge"}</button>
        </form>
        {verification.verification.challenge&&!verification.verification.verified?<form action={changeSeoDomainVerification}>
          <input type="hidden" name="siteId" value={site.id}/>
          <input type="hidden" name="action" value="check"/>
          <button type="submit" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Verify published DNS record</button>
        </form>:null}
      </div>
    </>:<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Domain ownership checks are unavailable until the SEO service and approved database migration are deployed.</p>}
  </section>:null}
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
   {opportunities.kind==="ready"&&opportunities.rows.length>0?<section className="overflow-hidden rounded-2xl border bg-white">
    <header className="border-b bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">Top query opportunities — current import</h2><p className="mt-1 text-xs text-slate-600">Up to 50 imported Search Console queries. Priority is a TAKATAK heuristic; positions and clicks come from the import.</p></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs">
      <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Query</th><th className="p-3 text-right">Clicks</th><th className="p-3 text-right">Impressions</th><th className="p-3 text-right">Position</th><th className="p-3 text-right">Priority</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{opportunities.rows.map((item,index)=><tr key={item.keyword+"-"+index}>
        <td className="p-3 font-medium text-slate-900">{item.keyword}</td><td className="p-3 text-right">{item.clicks.toLocaleString("en-CA")}</td><td className="p-3 text-right">{item.impressions.toLocaleString("en-CA")}</td><td className="p-3 text-right">{Number.isFinite(item.position)?item.position.toFixed(1):"—"}</td><td className="p-3 text-right">{item.priority}/100</td>
      </tr>)}</tbody>
    </table></div>
   </section>:<p className="rounded-xl border bg-white p-4 text-sm text-slate-500">No imported queries available for this client site yet. Link an owned Search Console property and use the import button in the portfolio.</p>}

   <div className="flex flex-wrap items-center gap-3">
    <Link href={"/api/seo/sites/"+site.id+"/opportunities.csv"} className="inline-flex rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">Download keyword sample (CSV) →</Link>
    <Link href={"/api/seo/sites/"+site.id+"/snapshot.json"} className="inline-flex rounded-xl border border-blue-300 px-5 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">Export site SEO data (JSON) →</Link>
   </div>
   <p className="text-xs text-slate-500">JSON snapshots cover up to 200 records per collection and indicate when the limit may omit data. They exclude DNS secrets and reviewer profile IDs. This does not export TAKATAK account data.</p>
  </section>}

  <section className="space-y-3 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-bold text-slate-950">Original SEO content briefs</h2>
    <p className="text-sm text-slate-600">Create editorial briefs for the site’s actual niche and audience. A client manager can approve or reject a draft after human review. Approval never publishes an article or creates a CMS record.</p>
    {briefResult?<p role="status" className={"rounded-xl p-3 text-sm "+(["created","reviewed"].includes(briefResult)?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900")}>
      {briefResult==="created"?"Content brief saved as a draft.":briefResult==="reviewed"?"Editorial decision saved. No content was published.":
       briefResult==="invalid"?"Provide a valid keyword and a detailed editorial angle.":
       briefResult==="unauthorized"?"You cannot create briefs in this workspace.":
       "The SEO service has not confirmed your brief. Please retry later."}
    </p>:null}
    {briefs.kind==="ready"?<>
      {briefs.rows.length===0?<p className="text-sm text-slate-500">No content briefs exist for this website yet.</p>:<div className="grid gap-3 md:grid-cols-2">
        {briefs.rows.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-slate-900">{item.keyword}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.angle}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{item.status==="draft"?"Draft only — not published":item.status==="approved"?"Approved for editorial planning — not published":"Rejected — not published"}</p>
          {item.review_note?<p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">Review: {item.review_note}</p>:null}
          {canManage&&item.status==="draft"?<form action={reviewSeoContentBrief} className="mt-3 space-y-2 border-t pt-3">
            <input type="hidden" name="siteId" value={siteId}/>
            <input type="hidden" name="briefId" value={item.id}/>
            <label className="block text-xs font-semibold text-slate-700">Human review decision
              <select name="status" defaultValue="approved" className="mt-1 w-full rounded-lg border p-2 text-xs">
                <option value="approved">Approve editorial plan</option>
                <option value="rejected">Reject and request changes</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">Review note (at least 10 characters if rejecting)
              <textarea name="note" maxLength={500} rows={2} className="mt-1 w-full rounded-lg border p-2 text-xs"/>
            </label>
            <p className="text-xs text-amber-800">The decision is final. It will not publish or distribute any article.</p>
            <button type="submit" className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Save review decision</button>
          </form>:null}
        </article>)}
      </div>}
      {canManage?<form action={createSeoContentBrief} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
        <input type="hidden" name="siteId" value={siteId}/>
        <label className="text-xs font-semibold text-slate-700">Topic or target keyword
          <input name="keyword" required minLength={2} maxLength={160} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="Best local services in Montreal"/>
        </label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Original editorial angle
          <textarea name="angle" required minLength={10} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="Who is the reader? What first-hand facts and independent sources should this article include?"/>
        </label>
        <button type="submit" className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white sm:col-span-2">Save content brief as draft</button>
      </form>:null}
    </>:<p className="text-sm text-amber-700">Content brief storage is not connected yet. No drafts are simulated.</p>}
  </section>

  <section className="space-y-3 rounded-2xl border bg-white p-5">
    <div>
      <h2 className="text-lg font-bold text-slate-950">Editorial backlink prospects</h2>
      {prospectResult?<p role="status" className={"mt-2 rounded-xl p-3 text-sm "+(["created","updated"].includes(prospectResult)?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900")}>{prospectResult==="created"?"Editorial opportunity recorded.":prospectResult==="updated"?"Prospect status saved.":prospectResult==="invalid"?"Check the publication URL, description and selected status.":prospectResult==="unauthorized"?"Your workspace role cannot modify these prospects.":"The backlink service did not confirm your change. Retry later."}</p>:null}
      <p className="mt-1 text-sm text-slate-600">Track relevant external publications and editorial outreach. A prospect is not a verified earned backlink; no emails are sent automatically.</p>
    </div>
    {prospects.kind==="ready"?<div className="space-y-3">
      {prospects.rows.length===0?<p className="text-sm text-slate-500">No backlink prospects recorded for this website.</p>:<div className="grid gap-3 md:grid-cols-2">{prospects.rows.map(item=><div key={item.id} className="rounded-xl border border-slate-200 p-4">
       <p className="font-semibold text-slate-900">{item.publication}</p>
       <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-xs text-blue-700 underline">{item.url}</a>
       <p className="mt-2 text-sm text-slate-600">{item.relevance}</p>
       <p className="mt-2 text-xs text-slate-500">Status: {item.status} · not independently verified</p>
       {canManage?<form action={changeBacklinkProspectStatus} className="mt-3 flex flex-wrap gap-2">
         <input type="hidden" name="siteId" value={siteId}/>
         <input type="hidden" name="prospectId" value={item.id}/>
         <label htmlFor={"prospect-status-"+item.id} className="sr-only">Prospect status</label>
         <select id={"prospect-status-"+item.id} name="status" defaultValue={item.status} className="rounded-lg border px-2 py-2 text-xs">
           <option value="identified">Identified</option><option value="researching">Researching</option>
           <option value="contacted">Contacted manually</option><option value="declined">Declined</option>
         </select>
         <button type="submit" className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Save status</button>
       </form>:null}
      </div>)}</div>}
    </div>:<p className="text-sm text-amber-700">Backlink prospect service not available. No results are simulated.</p>}
    {canManage&&prospects.kind==="ready"?<form action={createBacklinkProspect} className="grid gap-3 border-t pt-4 sm:grid-cols-2">
      <input type="hidden" name="siteId" value={siteId}/>
      <label className="text-xs font-semibold text-slate-700">Publication name<input name="publication" required minLength={2} maxLength={150} className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Relevant industry publisher"/></label>
      <label className="text-xs font-semibold text-slate-700">Public HTTPS page<input name="url" required type="url" maxLength={512} className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="https://publisher.example/article"/></label>
      <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Why is this relevant?<textarea name="relevance" required minLength={10} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Explain the niche and editorial connection."/></label>
      <button type="submit" className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white sm:col-span-2">Add editorial opportunity</button>
    </form>:null}
  </section>
 </main>;
}
