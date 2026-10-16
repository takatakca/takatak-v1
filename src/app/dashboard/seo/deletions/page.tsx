import Link from "next/link";
import { redirect } from "next/navigation";
import { requireGrowthAccess } from "@/lib/growth/access";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { getSeoDeletionReceipts } from "@/lib/seo/seotakatak-bridge";

export const dynamic="force-dynamic";
export const metadata={title:"SEO Deletion Receipts — TAKATAK",robots:{index:false,follow:false}};

export default async function SeoDeletionsPage({searchParams}:{
 searchParams:Promise<{offset?:string}>
}){
 const {access}=await requireGrowthAccess("/dashboard/seo/deletions");
 if(access.mode!=="client_scoped")
  redirect("/dashboard/select-client?next=%2Fdashboard%2Fseo%2Fdeletions");
 if(!hasEffectivePermission(access,"manage_integrations"))
  redirect("/dashboard/seo/portfolio");
 const offsetText=(await searchParams).offset??"0";
 const validOffset=/^(0|[1-9][0-9]{0,6})$/.test(offsetText)&&Number(offsetText)<=1_000_000;
 const offset=validOffset?Number(offsetText):0;
 const result=validOffset?await getSeoDeletionReceipts(offset):null;
 return <main className="space-y-5">
  <Link href="/dashboard/seo/portfolio" className="text-sm font-semibold text-blue-700 hover:underline">← Managed SEO sites</Link>
  <header className="rounded-2xl bg-gradient-to-r from-[#060D1F] to-[#145CCB] p-6 text-white">
   <p className="text-xs uppercase tracking-wider text-cyan-200">GROUPE TAKATAK · Client workspace audit</p>
   <h1 className="mt-2 text-2xl font-bold">SEO deletion receipts</h1>
   <p className="mt-2 text-sm text-blue-100">Recorded server-side when SEO sites are permanently removed. Receipts belong only to the selected TAKATAK client workspace.</p>
  </header>
  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
   These are operational database receipts, not legal certification that all personal data
   across TAKATAK products was erased. Retention policy and external backup lifecycle
   require separate approval.
  </p>
  {!validOffset?<p role="alert" className="text-sm text-red-700">Invalid pagination offset.</p>:null}
  {validOffset&&result?.kind!=="ready"?<p role="status" className="rounded-xl border bg-white p-4 text-sm text-amber-800">
   The SEO deletion audit is unavailable or not yet migrated. No receipts are simulated.
  </p>:null}
  {result?.kind==="ready"?<section className="space-y-4 rounded-2xl border bg-white p-5">
   <h2 className="text-lg font-semibold text-slate-950">Deletion events</h2>
   {result.page.receipts.length===0?<p className="text-sm text-slate-600">No deletion receipts on this page.</p>:
    <div className="overflow-x-auto">
     <table className="w-full min-w-[690px] text-left text-xs">
      <thead className="bg-slate-50 text-slate-700">
       <tr><th className="p-3">Deleted (UTC)</th><th className="p-3">Site ID</th><th className="p-3">Receipt ID</th><th className="p-3 text-right">Queries</th><th className="p-3 text-right">Prospects</th><th className="p-3 text-right">Briefs</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
       {result.page.receipts.map(item=><tr key={item.id}>
        <td className="p-3 text-slate-800">{item.deleted_at}</td>
        <td className="p-3 font-mono text-slate-700">{item.site_id}</td>
        <td className="p-3 font-mono text-slate-700">{item.id}</td>
        <td className="p-3 text-right">{item.opportunities_removed}</td>
        <td className="p-3 text-right">{item.prospects_removed}</td>
        <td className="p-3 text-right">{item.briefs_removed}</td>
       </tr>)}
      </tbody>
     </table>
    </div>}
   <div className="flex flex-wrap gap-3">
    {offset>0?<Link href="/dashboard/seo/deletions" className="rounded-lg border px-4 py-2 text-sm text-blue-700">First page</Link>:null}
    {result.page.hasMore&&result.page.nextOffset!==null?
      <Link href={"/dashboard/seo/deletions?offset="+result.page.nextOffset}
       className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Next receipts →</Link>:null}
   </div>
  </section>:null}
 </main>;
}
