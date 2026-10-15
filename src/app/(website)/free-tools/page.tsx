import Link from "next/link";
import type { Metadata } from "next";
import { SEO_CATEGORIES, SEO_FREE_TOOLS } from "@/lib/seo/free-tools-catalog";

export const metadata: Metadata={
 title:"Free SEO & AI Search Tools",
 description:"Free technical SEO scanners, AI discovery readiness checks, structured data generators and keyword analysis from TAKATAK. A free TAKATAK client account is required.",
 alternates:{canonical:"/free-tools"},
};

export default function PublicSeoToolsPage(){
 return <main className="tk-page brand-dark min-h-screen bg-[#060D1F] text-white">
  <section className="relative overflow-hidden bg-gradient-to-br from-[#060D1F] via-[#0B1B3D] to-[#1565D8] px-5 py-20 text-white sm:py-24">
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">GROUPE TAKATAK · SEO & AI Visibility</p>
      <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight sm:text-6xl">Free SEO tools for smarter organic growth</h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-blue-100">Audit technical discoverability, inspect metadata and build useful search-friendly documents. Use one secure TAKATAK account to access these tools for your business.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/register" className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0B1B3D] hover:bg-blue-50">Create your TAKATAK account</Link>
        <Link href="/login?next=%2Fdashboard%2Fseo%2Ffree-tools" className="rounded-xl border border-white/60 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">Sign in to use free tools</Link>
      </div>
      <p className="mt-5 text-xs text-blue-200">No separate SEO login or payment card. Account authentication and a client workspace are required to run tools.</p>
    </div>
  </section>
  <section className="bg-slate-50 px-5 py-14 text-slate-900">
   <div className="mx-auto max-w-6xl space-y-10">
    {SEO_CATEGORIES.map(category=><div key={category}>
      <h2 className="mb-4 text-2xl font-bold text-[#0B1B3D]">{category}</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
       {SEO_FREE_TOOLS.filter(tool=>tool.category===category).map(tool=><div key={tool.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
         <div className="mb-3 flex justify-between gap-2"><span className={"rounded-full px-2 py-1 text-[11px] font-semibold "+(tool.mode==="provider"?"bg-slate-100 text-slate-700":"bg-blue-50 text-blue-700")}>{tool.mode==="provider"?"Verified data connection required":"Free tool"}</span></div>
         <h3 className="text-lg font-bold text-slate-950">{tool.title}</h3>
         <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
         <Link href="/dashboard/seo/free-tools" className="mt-4 inline-flex text-sm font-bold text-blue-700 hover:underline">Open tool →</Link>
       </div>)}
      </div>
    </div>)}
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-blue-950">
      Our technical readiness checks are not proof of ChatGPT, Perplexity or Google placement. True citation, indexing and competitor measurements require supported data connections and verification.
    </div>
   </div>
  </section>
 </main>;
}
