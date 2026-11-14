import { ScanBarcode, ShieldCheck, Tags, Lock, ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
export const dynamic="force-dynamic";

export default function Sc4nnerDashboardPage(){
  const raw=process.env.TAKATAK_SC4NNER_URL || "";
  let appUrl:string | null=null;
  try{
    const url=new URL(raw);
    if(url.protocol==="https:" || process.env.NODE_ENV!=="production" && ["localhost","127.0.0.1"].includes(url.hostname)){
      appUrl=url.origin;
    }
  }catch{}
  return <div className="space-y-6">
    <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-7 text-white">
      <div className="mb-4 flex items-center gap-3"><ScanBarcode className="h-9 w-9 text-sky-300"/><span className="text-xs font-bold uppercase tracking-widest text-blue-200">GROUPE TAKATAK / ATELIER</span></div>
      <h1 className="text-3xl font-bold">SC4NNER</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Design product labels, verify barcodes and export print-ready PDFs from the TAKATAK label studio. In private testing.</p>
      {appUrl?<a className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-400" href={appUrl+"/auth/start"}>Open SC4NNER <ExternalLink className="h-4 w-4"/></a>:<div className="mt-4 rounded-lg border border-amber-400/50 bg-amber-950/40 px-4 py-3 text-sm">SC4NNER has not been connected to its deployment domain. No login bridge is active here yet.</div>}
    </div>
    <section className="grid gap-4 md:grid-cols-3">
      <Card><CardHeader title="The label studio" subtitle="Labels, barcodes and print PDFs" /><CardBody><Tags className="mb-3 h-7 w-7 text-blue-600"/><p className="text-sm text-slate-600">Build label templates for your products, run the declared checks and keep every saved version in the studio.</p></CardBody></Card>
      <Card><CardHeader title="One secure identity" subtitle="Managed by TAKATAK-V1" /><CardBody><ShieldCheck className="mb-3 h-7 w-7 text-blue-600"/><p className="text-sm text-slate-600">You sign in here. SC4NNER receives only short-lived access context for your account.</p></CardBody></Card>
      <Card><CardHeader title="Your labels stay there" subtitle="Never stored in this dashboard" /><CardBody><Lock className="mb-3 h-7 w-7 text-blue-600"/><p className="text-sm text-slate-600">Products, labels and scan results are kept in SC4NNER, visible only to your account.</p></CardBody></Card>
    </section>
  </div>;
}
