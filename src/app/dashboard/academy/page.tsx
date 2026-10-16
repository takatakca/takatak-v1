import Link from "next/link";
import { GraduationCap, ShieldCheck, BookOpen, CircleDollarSign, ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
export const dynamic="force-dynamic";

export default function AcademyDashboardPage(){
  const raw=process.env.TAKATAK_ACADEMY_URL || "";
  let academyUrl:string | null=null;
  try{
    const url=new URL(raw);
    if(url.protocol==="https:" || process.env.NODE_ENV!=="production" && ["localhost","127.0.0.1"].includes(url.hostname)){
      academyUrl=url.origin;
    }
  }catch{}
  return <div className="space-y-6">
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-7 text-white">
      <div className="mb-4 flex items-center gap-3"><GraduationCap className="h-9 w-9 text-sky-300"/><span className="text-xs font-bold uppercase tracking-widest text-blue-200">GROUPE TAKATAK / LEARNING HUB</span></div>
      <h1 className="text-3xl font-bold">TAKATAK Academy</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Learn the skills behind the tools you use in your main TAKATAK dashboard. Start with free lessons and choose a learning pathway for your business or career.</p>
      {academyUrl?<a className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-400" href={academyUrl+"/auth/start"}>Open Academy <ExternalLink className="h-4 w-4"/></a>:<div className="mt-4 rounded-lg border border-amber-400/50 bg-amber-950/40 px-4 py-3 text-sm">Academy has not been connected to its public deployment domain. No login bridge is active here yet.</div>}
    </div>
    <section className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader title="Free learning" subtitle="Open introductory courses" /><CardBody><BookOpen className="mb-3 h-7 w-7 text-blue-600"/><p className="text-sm text-slate-600">Browse marketing, SEO, commerce and digital-skills lessons without paying.</p></CardBody></Card>
      <Card><CardHeader title="Premium curriculum" subtitle="Planned recurring subscription" /><CardBody><CircleDollarSign className="mb-3 h-7 w-7 text-blue-600"/><p className="text-sm text-slate-600">Paid access is not enabled until TAKATAK Billing verifies subscriptions and grants entitlements.</p></CardBody></Card>
      <Card><CardHeader title="One secure identity" subtitle="Managed by TAKATAK-V1" /><CardBody><ShieldCheck className="mb-3 h-7 w-7 text-blue-600"/><p className="text-sm text-slate-600">Your master identity stays here. Academy receives only short-lived access context.</p></CardBody></Card>
    </section>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Your TAKATAK account remains the source of truth for subscriptions, purchases and permissions. <Link href="/dashboard/billing" className="font-semibold text-blue-700 hover:underline">View main dashboard billing</Link>. Paid Academy purchases are not yet listed or available there.
    </div>
  </div>;
}
