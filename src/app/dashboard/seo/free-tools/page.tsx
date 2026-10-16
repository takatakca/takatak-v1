import { redirect } from "next/navigation";
import Link from "next/link";
import { requireGrowthAccess } from "@/lib/growth/access";
import { SeoFreeToolsClient } from "./tools-client";

export const dynamic = "force-dynamic";
export const metadata={ title:"Free SEO & AI Visibility Tools — TAKATAK",robots:{index:false,follow:false} };

export default async function FreeSeoToolsPage(){
  const {access}=await requireGrowthAccess("/dashboard/seo/free-tools");
  // The existing TAKATAK Auth session + active, entitled workspace remain mandatory.
  if(access.mode!=="client_scoped")redirect("/dashboard/select-client?next=%2Fdashboard%2Fseo%2Ffree-tools");
  return <main className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/dashboard/seo" className="text-sm font-semibold text-blue-700 hover:underline">← SEO dashboard</Link>
      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">TAKATAK account · Client workspace</span>
    </div>
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#060D1F] via-[#0B1B3D] to-[#145CCB] p-6 text-white shadow-xl sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">GROUPE TAKATAK · Growth Suite</p>
      <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">Free SEO & AI Visibility Tools</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-100">Check technical search readiness, create clean markup and plan better content—all from your secure TAKATAK client dashboard. No separate login or payment card.</p>
      <p className="mt-4 text-xs leading-5 text-blue-200">These tools do not guarantee rankings. AI answer citations, Google index status and competitor metrics require verifiable data from connected providers.</p>
    </div>
    <SeoFreeToolsClient/>
  </main>;
}
