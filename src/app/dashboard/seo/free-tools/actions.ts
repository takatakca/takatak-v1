"use server";
import { fetchPublicPage, runSiteAudit } from "@/lib/seo/site-audit";
import { listGoogleLinkedSites } from "@/lib/analytics/service";
import { fetchGoogleIndexInspection } from "@/lib/integrations/google/client";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export type LiveSeoResult = { ok:false;error:string } | {
  ok:true; finalUrl:string; status:number; inspectedAt:string; type:"page"|"robots"|"sitemap";
  data: Record<string,string|number|boolean|string[]>;
};
const text=(v:string)=>v.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,500);
function attributes(tag:string) {
  const attrs:Record<string,string>={};
  for(const match of tag.matchAll(/([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    attrs[match[1].toLowerCase()]=(match[2]??match[3]??match[4]??"").slice(0,512);
  }
  return attrs;
}
function pageFacts(html:string,finalUrl:string):Record<string,string|number|boolean|string[]> {
  const head=html.match(/<head\b[\s\S]*?<\/head>/i)?.[0]??html.slice(0,120000);
  const metas=[...head.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const meta=(key:string)=>metas.find(a=>a.name?.toLowerCase()===key||a.property?.toLowerCase()===key)?.content??"";
  const canonical=[...head.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0])).find(a=>a.rel?.toLowerCase().split(/\s+/).includes("canonical"))?.href??"";
  const h1=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].slice(0,10).map(m=>text(m[1]));
  const body=html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]??html;
  const wordCount=text(body).split(/\s+/).filter(Boolean).length; // capped sample; not whole-page word count
  const title=text(head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??"");
  let canonicalStatus="Missing";
  if(canonical){
    try{const resolved=new URL(canonical,finalUrl);const current=new URL(finalUrl);canonicalStatus=resolved.origin===current.origin&&resolved.pathname===current.pathname?"Matches this page":resolved.hostname===current.hostname?"Points to another page":"Points to another domain";}
    catch{canonicalStatus="Invalid canonical URL";}
  }
  return {
    title,titleLength:title.length,description:meta("description"),descriptionLength:meta("description").length,h1,h1Count:h1.length,canonical,canonicalStatus,
    robotsMeta:meta("robots"),ogTitle:meta("og:title"),ogDescription:meta("og:description"),
    ogImage:meta("og:image"),twitterCard:meta("twitter:card"),
    jsonLdBlocks:(html.match(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json/gi)||[]).length,
    approximateSampleWords:wordCount,
    language:html.match(/<html\b[^>]*\blang\s*=\s*["']?([^"'\s>]+)/i)?.[1]??"",
  };
}
function robotsFacts(body:string):Record<string,string|number|boolean|string[]>{
  const lines=body.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("#"));
  let agent="";
  let blocksAll=false;
  const sitemaps:string[]=[];
  for(const line of lines){
    const match=line.match(/^([a-z-]+)\s*:\s*(.*)$/i);if(!match)continue;
    const [,key,value]=match;
    if(key.toLowerCase()==="user-agent")agent=value.toLowerCase();
    if(key.toLowerCase()==="disallow"&&value==="/"&&agent==="*")blocksAll=true;
    if(key.toLowerCase()==="sitemap")sitemaps.push(value.slice(0,500));
  }
  return {directives:lines.slice(0,60),lines:lines.length,blocksAll,sitemaps};
}
function sitemapFacts(body:string,finalUrl:string):Record<string,string|number|boolean|string[]>{
  const found=/<(?:[a-z][\w-]*:)?(urlset|sitemapindex)\b/i.exec(body);
  const locs=[...body.matchAll(/<(?:[a-z][\w-]*:)?loc\b[^>]*>([^<]*)<\/(?:[a-z][\w-]*:)?loc>/gi)].slice(0,300).map(m=>m[1].trim());
  const base=new URL(finalUrl);
  const cross=locs.filter(x=>{try{return new URL(x).hostname!==base.hostname;}catch{return true;}});
  return {format:found?.[1]??"Unrecognized XML",sampledUrls:locs.length,crossDomainCount:cross.length,crossDomainExamples:cross.slice(0,5),truncatedSample:locs.length>=300};
}
export async function scanFreeSeoTool(input:{url:string;toolId:string}):Promise<LiveSeoResult>{
  const {access}=await getServerAccessContext();
  if(access.mode!=="client_scoped"||!hasEffectivePermission(access,"view_dashboard"))return {ok:false,error:"Sign in to an authorized TAKATAK client workspace."};
  const allowed=new Set(["geo-audit","ai-seo-audit","robots-checker","sitemap-checker","canonical-checker","ai-readability-checker","h1-checker","meta-description-checker","open-graph-checker"]);
  if(!allowed.has(input.toolId))return {ok:false,error:"This tool does not support live scanning."};
  if(typeof input.url!=="string"||input.url.length>1800)return {ok:false,error:"Enter a valid public website URL."};
  try{
    if(input.toolId==="geo-audit"||input.toolId==="ai-seo-audit"){
      const result=await runSiteAudit(input.url);
      if(!result.ok)return {ok:false,error:result.error};
      const audit=result.report;
      const priorityFixes=audit.checks.filter(check=>check.status!=="pass").sort((a,b)=>b.weight-a.weight).slice(0,10).map(check=>check.label+": "+check.detail);
      return {ok:true,finalUrl:audit.finalUrl,status:audit.statusCode,inspectedAt:audit.auditedAt,type:"page",data:{
        technicalSeoScore:audit.score,
        title:audit.facts.title??"",description:audit.facts.description??"",
        h1Count:audit.facts.h1.length,h1:audit.facts.h1,
        totalWords:audit.facts.wordCount,
        checksPassed:audit.checks.filter(check=>check.status==="pass").length,
        checksNeedingAttention:audit.checks.filter(check=>check.status!=="pass").length,
        priorityFixes,
        note:"Technical readiness only; AI assistant indexing and citation ranking are not measured.",
      }};
    }
    const supplied=/^https?:\/\//i.test(input.url.trim())?input.url.trim():"https://"+input.url.trim();
    const url=new URL(supplied);
    if(!["https:","http:"].includes(url.protocol)||url.username||url.password)return {ok:false,error:"Enter a public http/https URL."};
    if(input.toolId==="robots-checker")url.pathname="/robots.txt";
    if(input.toolId==="sitemap-checker")url.pathname="/sitemap.xml";
    if(["robots-checker","sitemap-checker"].includes(input.toolId)){url.search="";url.hash="";}
    const page=await fetchPublicPage(url.toString());
    if(!page)return {ok:false,error:"Could not fetch this public URL (or it failed safety checks)."};
    const type=input.toolId==="robots-checker"?"robots":input.toolId==="sitemap-checker"?"sitemap":"page";
    return {ok:true,finalUrl:page.finalUrl.toString(),status:page.status,inspectedAt:new Date().toISOString(),type,
      data:type==="robots"?robotsFacts(page.body):type==="sitemap"?sitemapFacts(page.body,page.finalUrl.toString()):pageFacts(page.body,page.finalUrl.toString())};
  }catch{return {ok:false,error:"Enter a valid public website URL."};}
}


export type GoogleIndexToolResult={ok:false;error:string}|{ok:true;property:string;facts:Record<string,string>};
/** Inspect only a URL whose domain belongs to a linked, verified TAKATAK client workspace. */
export async function inspectGoogleIndexForWorkspace(rawUrl:string):Promise<GoogleIndexToolResult>{
 const {access}=await getServerAccessContext();
 if(access.mode!=="client_scoped"||!hasEffectivePermission(access,"view_reports"))return {ok:false,error:"An authorized TAKATAK client workspace with reporting access is required."};
 if(typeof rawUrl!=="string"||rawUrl.length>1800)return {ok:false,error:"Enter a valid public website URL."};
 let url:URL;
 try{url=new URL(/^https?:\/\//i.test(rawUrl.trim())?rawUrl.trim():"https://"+rawUrl.trim());}
 catch{return {ok:false,error:"Enter a valid URL."};}
 if(!["https:","http:"].includes(url.protocol)||url.username||url.password||url.port||!url.hostname.includes("."))return {ok:false,error:"Enter a public http/https URL."};
 try{
  const sites=(await listGoogleLinkedSites(access.activeClientId)).filter(site=>!!site.searchConsoleProperty);
  const linked=sites.find(site=>{
    const base=site.domain.toLowerCase().replace(/^www\./,"");
    const hostname=url.hostname.toLowerCase().replace(/^www\./,"");
    if(base!==hostname||!site.searchConsoleProperty)return false;
    if(site.searchConsoleProperty.startsWith("http")){
      try{
        const prefix=new URL(site.searchConsoleProperty);
        return prefix.origin===url.origin&&url.pathname.startsWith(prefix.pathname);
      }catch{return false;}
    }
    return site.searchConsoleProperty.startsWith("sc-domain:");
  });
  if(!linked?.searchConsoleProperty)return {ok:false,error:"This URL is not linked to a verified Search Console property in your current TAKATAK workspace."};
  const inspection=await fetchGoogleIndexInspection(linked.searchConsoleProperty,url.toString());
  if(!inspection.ok)return {ok:false,error:"Google inspection is unavailable: "+inspection.reason.replace(/_/g," ")};
  return {ok:true,property:linked.searchConsoleProperty,facts:inspection.data};
 }catch{return {ok:false,error:"Search Console could not be reached for this workspace."};}
}
