"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { SEO_CATEGORIES, SEO_FREE_TOOLS, type SeoTool, type SeoToolCategory } from "@/lib/seo/free-tools-catalog";
import { scanFreeSeoTool, inspectGoogleIndexForWorkspace, type LiveSeoResult, type GoogleIndexToolResult } from "./actions";

type Group = SeoToolCategory | "All";
function origin(input:string) {
  try {const u=new URL(/^https?:\/\//i.test(input)?input:"https://"+input);return ["http:","https:"].includes(u.protocol)&&u.hostname.includes(".")&&!u.username&&!u.password?u.origin:null;}catch{return null;}
}
function generate(id:string,url:string,title:string,description:string,blockAi:boolean,kind:string) {
  const site=origin(url);
  if(id==="robots-generator")return site?"User-agent: *\nAllow: /\n\nSitemap: "+site+"/sitemap.xml\n"+(blockAi?"\n# Optional AI crawler controls\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n":""):"Enter a valid public domain first.";
  if(id==="llms-generator")return site?"# "+(title||new URL(site).hostname)+"\n\n> "+(description||"Add an accurate overview of your website")+"\n\n## Main pages\n\n- [Home]("+site+"/)\n- [About]("+site+"/about)\n\nReview links for accuracy before publishing.":"Enter a valid public domain first.";
  if(id==="schema-generator")return site?JSON.stringify({"@context":"https://schema.org","@type":kind,"name":title||new URL(site).hostname,"url":site+"/",...(description?{description}:{})},null,2):"Enter a valid public domain first.";
  return "";
}
function density(value:string){
 const words=(value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).slice(0,12000);
 const counts=new Map<string,number>();
 for(let n=1;n<=4;n++)for(let i=0;i+n<=words.length;i++){
   const phrase=words.slice(i,i+n).join(" ");if(phrase.length<3)continue;
   counts.set(phrase,(counts.get(phrase)??0)+1);
 }
 return {total:words.length,top:[...counts].filter(([,count])=>count>=2).sort((a,b)=>b[1]-a[1]).slice(0,16)};
}
function pretty(key:string){return key.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase());}
export function SeoFreeToolsClient(){
 const [group,setGroup]=useState<Group>("All");
 const [id,setId]=useState("geo-audit");
 const [url,setUrl]=useState("");
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [content,setContent]=useState("");
 const [blockAi,setBlockAi]=useState(false);
 const [kind,setKind]=useState("Organization");
 const [report,setReport]=useState<LiveSeoResult|null>(null);
 const [googleReport,setGoogleReport]=useState<GoogleIndexToolResult|null>(null);
 const [busy,setBusy]=useState(false);
 const [copyLabel,setCopyLabel]=useState("Copy");
 const tool=SEO_FREE_TOOLS.find(t=>t.id===id)??SEO_FREE_TOOLS[0];
 const matches=SEO_FREE_TOOLS.filter(t=>group==="All"||t.category===group);
 const draft=useMemo(()=>generate(id,url,title,description,blockAi,kind),[id,url,title,description,blockAi,kind]);
 const frequencies=useMemo(()=>density(content),[content]);
 const choose=(selected:SeoTool)=>{setId(selected.id);setReport(null);setGoogleReport(null);setCopyLabel("Copy");};
 const scan=async()=>{
   if(busy||!url.trim())return;setBusy(true);setReport(null);
   try{setReport(await scanFreeSeoTool({url,toolId:id}));}
   catch{setReport({ok:false,error:"Unable to scan the page right now."});}
   finally{setBusy(false);}
 };
 return <div className="space-y-6">
   <div role="group" aria-label="Filter free tools" className="flex flex-wrap gap-2">
    {(["All",...SEO_CATEGORIES] as Group[]).map(c=><button key={c} type="button" onClick={()=>setGroup(c)} aria-pressed={group===c} className={"rounded-full border px-3 py-2 text-xs font-semibold "+(group===c?"border-blue-700 bg-blue-700 text-white":"border-slate-200 bg-white text-slate-700 hover:border-blue-400")}>{c==="All"?"All tools":c}</button>)}
   </div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {matches.map(t=><button key={t.id} type="button" onClick={()=>choose(t)} aria-pressed={id===t.id} className={"rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 "+(id===t.id?"border-blue-600 bg-blue-50":"border-slate-200 bg-white hover:border-blue-400")}>
     <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-blue-700">{t.category}</span><span className={"rounded-full px-2 py-1 text-[10px] font-semibold "+(t.mode==="provider"?"bg-slate-100 text-slate-600":"bg-emerald-50 text-emerald-700")}>{t.mode==="provider"?"Provider required":"Free"}</span></div>
     <h2 className="mt-2 text-sm font-bold text-slate-950">{t.title}</h2>
     <p className="mt-2 text-xs leading-5 text-slate-600">{t.description}</p>
    </button>)}
   </div>
   <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg" aria-label="Selected SEO checker">
    <header className="border-b bg-slate-50 px-6 py-5"><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{tool.category}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{tool.title}</h2><p className="mt-2 text-sm text-slate-600">{tool.description}</p></header>
    <div className="space-y-4 p-5 sm:p-6">
     {tool.mode==="provider"?<div className="space-y-4">
       <p className="text-sm text-slate-700">This feature needs a verified provider or recorded AI-search evidence. We never invent Google indexing, AI citations, backlink counts or competitor rankings.</p>
       {id==="google-index-checker"?<div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
         <p className="text-xs text-blue-950">If your workspace has a verified website connected to Google Search Console, use the official Google URL Inspection API to check its current indexing signals.</p>
         <form onSubmit={e=>{e.preventDefault();if(busy)return;setBusy(true);setGoogleReport(null);void inspectGoogleIndexForWorkspace(url).then(setGoogleReport).catch(()=>setGoogleReport({ok:false,error:"Google inspection failed."})).finally(()=>setBusy(false));}} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="google-index-url" className="sr-only">URL to inspect in Google</label>
          <input id="google-index-url" type="text" inputMode="url" required maxLength={1800} value={url} onChange={e=>setUrl(e.target.value)} className="min-w-0 flex-1 rounded-lg border bg-white p-3 text-sm" placeholder="https://your-verified-domain.ca/page"/>
          <button type="submit" disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?"Inspecting…":"Inspect URL"}</button>
         </form>
         {googleReport?.ok===false?<p role="alert" className="text-sm text-rose-700">{googleReport.error}</p>:null}
         {googleReport?.ok===true?<div aria-live="polite"><p className="mb-2 break-words text-xs font-semibold text-blue-900">Search Console property: {googleReport.property}</p><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(googleReport.facts).map(([key,value])=><div className="rounded-lg bg-white p-3" key={key}><dt className="text-xs font-semibold text-slate-600">{pretty(key)}</dt><dd className="mt-1 break-words text-sm text-slate-900">{value||"Not supplied by Google"}</dd></div>)}</dl></div>:null}
       </div>:null}
       <Link href={["google-index-checker","missing-keywords","ai-overview-checker"].includes(id)?"/dashboard/seo/keywords":"/dashboard/seo/backlinks"} className="inline-flex rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">View TAKATAK SEO connectors →</Link>
      </div>:null}
     {tool.mode==="live"?<div className="space-y-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e=>{e.preventDefault();void scan();}}>
       <label htmlFor="seo-free-url" className="sr-only">Public website URL</label><input id="seo-free-url" type="text" inputMode="url" value={url} maxLength={1800} onChange={e=>setUrl(e.target.value)} required placeholder="https://example.com" className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:ring-2 focus:ring-blue-200"/>
       <button type="submit" disabled={busy} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{busy?"Checking…":"Run free check"}</button>
      </form>
      {report?.ok===false?<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{report.error}</p>:null}
      {report?.ok===true?<div aria-live="polite" className="space-y-3"><p className="break-all text-xs text-slate-500">HTTP {report.status} · {report.finalUrl} · {new Date(report.inspectedAt).toLocaleString()}</p><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(report.data).map(([name,value])=><div key={name} className="min-w-0 rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-semibold uppercase text-slate-500">{pretty(name)}</dt><dd className="mt-1 break-words text-sm text-slate-900">{Array.isArray(value)?value.join(" · ")||"None":typeof value==="boolean"?(value?"Yes":"No"):String(value)||"Not found"}</dd></div>)}</dl><p className="text-xs text-slate-500">Technical readiness only, not evidence of Google indexing or AI citation. Sitemap results are sampled.</p></div>:null}
      {["geo-audit","ai-seo-audit"].includes(id)?<Link href="/dashboard/seo" className="text-sm font-semibold text-blue-700 hover:underline">Run the full scored website audit →</Link>:null}
     </div>:null}
     {tool.mode==="generator"?<div className="space-y-4">
      {id!=="serp-snippet-preview"?<label className="block text-xs font-semibold text-slate-700">Your public domain<input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-xl border p-3 text-sm"/></label>:null}
      {["serp-snippet-preview","llms-generator","schema-generator"].includes(id)?<>
       <label className="block text-xs font-semibold text-slate-700">Title / business name<input maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 w-full rounded-xl border p-3 text-sm" placeholder="Your page title"/></label>
       <label className="block text-xs font-semibold text-slate-700">Factual description<textarea maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border p-3 text-sm" placeholder="Describe the page"/></label>
      </>:null}
      {id==="robots-generator"?<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={blockAi} onChange={e=>setBlockAi(e.target.checked)}/> Add optional AI crawler blocking directives</label>:null}
      {id==="schema-generator"?<label className="block text-xs font-semibold text-slate-700">Schema type<select value={kind} onChange={e=>setKind(e.target.value)} className="mt-2 block rounded-xl border px-3 py-2 text-sm"><option>Organization</option><option>WebSite</option></select></label>:null}
      {id==="serp-snippet-preview"?<div className="space-y-2 rounded-xl border p-4"><p className="text-xs text-slate-500">Approximate search snippet (Google may rewrite)</p><p className="text-sm text-emerald-700">{origin(url)||"https://example.com"}</p><p className="break-words text-lg text-blue-700">{title.slice(0,65)||"Your title here"}</p><p className="break-words text-sm text-slate-700">{description.slice(0,160)||"Add a description"}</p><p className="text-xs text-slate-500">Title {title.length} characters · description {description.length} characters</p><label className="block text-xs text-slate-600">Preview URL<input value={url} onChange={e=>setUrl(e.target.value)} className="mt-2 w-full rounded-xl border p-2 text-sm"/></label></div>:<>
       <textarea aria-label="Generated document" readOnly value={draft} rows={10} className="w-full rounded-xl border bg-slate-50 p-4 font-mono text-xs"/>
       <button type="button" onClick={()=>{void navigator.clipboard.writeText(draft).then(()=>setCopyLabel("Copied")).catch(()=>setCopyLabel("Copy unavailable"));}} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">{copyLabel}</button>
      </>}
      <p className="text-xs text-slate-500">Review every field and link before publishing. llms.txt is optional and not a universal AI indexing requirement.</p>
     </div>:null}
     {tool.mode==="text"?<div className="space-y-3">
      <label htmlFor="seo-text" className="text-sm font-semibold text-slate-700">Paste content</label><textarea id="seo-text" value={content} maxLength={50000} onChange={e=>setContent(e.target.value)} rows={8} className="w-full rounded-xl border p-4 text-sm" placeholder={id==="llms-validator"?"# Website\n\n> Summary\n\n## Important pages\n- [Home](https://example.com/)":"Paste your article or page content"}/>
      {id==="llms-validator"?<div className="space-y-2 rounded-xl border p-4 text-sm"><p>{/^# .+/m.test(content)?"✓ H1 present":"• Add a # heading"}</p><p>{/^## .+/m.test(content)?"✓ Section headings present":"• Add ## sections"}</p><p>{/\[[^\]]+\]\(https:\/\/[^)]+\)/i.test(content)?"✓ Absolute HTTPS Markdown link present":"• Add at least one Markdown HTTPS link"}</p><p className="text-xs text-slate-500">Basic Markdown checks only; no universally mandated llms.txt standard.</p></div>:null}
      {id==="keyword-density-checker"?<div className="space-y-2"><p className="text-xs text-slate-500">{frequencies.total} words · top repeated 1–4 word phrases, based on pasted text</p><div className="max-h-64 overflow-auto rounded-xl border"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Phrase</th><th className="p-2">Count</th><th className="p-2">Occurrences / 100 words</th></tr></thead><tbody>{frequencies.top.map(([phrase,count])=><tr key={phrase} className="border-t"><td className="p-2">{phrase}</td><td className="p-2">{count}</td><td className="p-2">{frequencies.total?((count/frequencies.total)*100).toFixed(1):"0"}</td></tr>)}</tbody></table></div></div>:null}
     </div>:null}
    </div>
   </section>
   <p className="text-xs text-slate-500">All tools are inside TAKATAK Auth. AI answer visibility and organic rankings are never guaranteed.</p>
 </div>;
}
