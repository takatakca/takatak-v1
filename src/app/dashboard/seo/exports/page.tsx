import Link from "next/link";
import { redirect } from "next/navigation";
import { requireGrowthAccess } from "@/lib/growth/access";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { getSeoWorkspaceExportPage, type SeoExportCollection } from "@/lib/seo/seotakatak-bridge";

export const dynamic="force-dynamic";
export const metadata={title:"SEO Workspace Data Export — TAKATAK",robots:{index:false,follow:false}};
const collections:SeoExportCollection[]=["sites","opportunities","prospects","briefs"];

export default async function SeoExportsPage({searchParams}:{
 searchParams:Promise<{collection?:string;offset?:string}>
}){
 const {access}=await requireGrowthAccess("/dashboard/seo/exports");
 if(access.mode!=="client_scoped")redirect("/dashboard/select-client?next=%2Fdashboard%2Fseo%2Fexports");
 if(!hasEffectivePermission(access,"view_reports"))redirect("/dashboard/seo");
 const params=await searchParams;
 const collection=collections.includes(params.collection as SeoExportCollection)?
  params.collection as SeoExportCollection:"sites";
 const offsetText=params.offset??"0";
 const validOffset=/^(0|[1-9][0-9]{0,6})$/.test(offsetText)&&Number(offsetText)<=1_000_000;
 const offset=validOffset?Number(offsetText):0;
 const result=validOffset?await getSeoWorkspaceExportPage(collection,offset):null;
 const link=(name:SeoExportCollection,at=0)=>"/dashboard/seo/exports?collection="+name+"&offset="+at;
 return <main className="space-y-5">
  <Link href="/dashboard/seo/portfolio" className="text-sm font-semibold text-blue-700 hover:underline">← Managed SEO sites</Link>
  <header className="rounded-2xl bg-gradient-to-r from-[#060D1F] to-[#145CCB] p-6 text-white">
   <p className="text-xs uppercase tracking-wider text-cyan-200">TAKATAK Auth · Current workspace only</p>
   <h1 className="mt-2 text-2xl font-bold">Export workspace SEO data</h1>
   <p className="mt-2 text-sm text-blue-100">Each collection is exported in consecutive pages of up to 200 records. Download every page to gather the current SEO dataset; your TAKATAK identity and other products remain separate.</p>
  </header>
  <nav className="flex flex-wrap gap-2" aria-label="SEO export collection">
   {collections.map(item=><Link key={item} href={link(item)} className={"rounded-xl px-4 py-2 text-sm font-semibold "+(item===collection?"bg-blue-700 text-white":"border border-blue-200 text-blue-700 hover:bg-blue-50")}>{item}</Link>)}
  </nav>
  {!validOffset?<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Invalid pagination offset. Return to the first page.</p>:null}
  {validOffset&&result?.kind!=="ready"?<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">The SEO workspace data service is not currently available. No data is simulated or exported.</p>:null}
  {result?.kind==="ready"?<section className="space-y-4 rounded-2xl border bg-white p-6">
    <h2 className="text-lg font-bold text-slate-900">{collection} · offset {offset}</h2>
    <p className="text-sm text-slate-600">{result.page.records.length} record(s) in this page. {result.page.hasMore?"Additional records exist; continue to the next page.":"No further records reported for this collection."}</p>
    <div className="flex flex-wrap gap-3">
     <Link href={"/api/seo/workspace/export/"+collection+"?offset="+offset} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">Download this JSON page →</Link>
     {result.page.hasMore&&result.page.nextOffset!==null?<Link href={link(collection,result.page.nextOffset)} className="rounded-xl border border-blue-200 px-5 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50">Next page →</Link>:null}
     {offset>0?<Link href={link(collection)} className="px-3 py-3 text-sm text-blue-700 underline">First page</Link>:null}
    </div>
    <p className="text-xs text-slate-500">Pages are ordered by database record ID. This is not a transactionally consistent snapshot: changes during multi-page download could affect coverage. No DNS secrets or reviewer identities are included.</p>
   </section>:null}
 </main>;
}
