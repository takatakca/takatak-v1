import "server-only";
import { createHmac } from "node:crypto";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export interface SeoManagedSite {
 id:string;domain:string;niche:string;market:string;locale:string;created_at?:string;
}
export type SeoPortfolioResult =
 | {kind:"ready";sites:SeoManagedSite[]}
 | {kind:"unconfigured"|"unauthorized"|"unavailable";sites:[]};

function configuredEndpoint():{origin:string;key:string}|null {
 const supplied=process.env.SEOTAKATAK_API_URL;
 const key=process.env.SEOTAKATAK_SIGNING_KEY;
 if(!supplied||!key||key.length<32)return null;
 try {
  const parsed=new URL(supplied);
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.port||parsed.pathname!=="/"||parsed.search||parsed.hash)return null;
  return {origin:parsed.origin,key};
 } catch {return null;}
}
function signWorkspace(input:{tenantId:string;profileId:string;manage:boolean;ingest:boolean},key:string):string {
 const now=Math.floor(Date.now()/1000);
 const encoded=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString("base64url");
 const msg=encoded({alg:"HS256",typ:"JWT"})+"."+encoded({iss:"takatak-v1",aud:"seotakatak",sub:input.profileId,tenant_id:input.tenantId,permissions:input.ingest?["seo:import"]:input.manage?["seo:view","seo:manage"]:["seo:view"],iat:now,exp:now+60});
 return msg+"."+createHmac("sha256",key).update(msg).digest("base64url");
}
async function callSeo(path:string,method:"GET"|"POST",payload?:Record<string,unknown>,ingest=false) {
 if(path!=="/v1/sites"&&!/^\/v1\/sites\/[0-9a-f-]{36}\/(opportunities\/import|summary)$/.test(path))return {kind:"unavailable" as const,sites:[]};
 const {access}=await getServerAccessContext();
 if(access.mode!=="client_scoped"||!hasEffectivePermission(access,"view_dashboard"))return {kind:"unauthorized" as const,sites:[]};
 if(path.endsWith("/summary")&&!hasEffectivePermission(access,"view_reports"))return {kind:"unauthorized" as const,sites:[]};
 const manage=method!=="GET"&&!ingest;
 if(ingest&&(!hasEffectivePermission(access,"view_reports")||!hasEffectivePermission(access,"manage_integrations")))return {kind:"unauthorized" as const,sites:[]};
 if(manage&&!hasEffectivePermission(access,"manage_integrations"))return {kind:"unauthorized" as const,sites:[]};
 const config=configuredEndpoint();
 if(!config)return {kind:"unconfigured" as const,sites:[]};
 const signal=AbortSignal.timeout(7000);
 try {
  const response=await fetch(config.origin+path,{
   method,
   headers:{Authorization:"Bearer "+signWorkspace({tenantId:access.activeClientId,profileId:access.profileId,manage,ingest},config.key),Accept:"application/json",...(payload?{"Content-Type":"application/json"}:{})},
   body:payload?JSON.stringify(payload):undefined,
   cache:"no-store",
   redirect:"error",
   signal,
  });
  if(!response.ok)return {kind:response.status===401||response.status===403?"unauthorized" as const:"unavailable" as const,sites:[]};
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||!("ok" in data)||(data as {ok:unknown}).ok!==true)return {kind:"unavailable" as const,sites:[]};
  return {kind:"ready" as const,data};
 }catch{return {kind:"unavailable" as const,sites:[]};}
}
export async function listSeoManagedSites():Promise<SeoPortfolioResult>{
 const response=await callSeo("/v1/sites","GET");
 if(response.kind!=="ready")return {kind:response.kind,sites:[]};
 const value=response.data as {sites?:unknown};
 if(!Array.isArray(value.sites))return {kind:"unavailable",sites:[]};
 const sites:SeoManagedSite[]=value.sites.filter((s):s is SeoManagedSite=>
  !!s&&typeof s==="object"&&typeof s.id==="string"&&typeof s.domain==="string"&&typeof s.niche==="string"&&typeof s.market==="string"
 ).map(s=>({id:s.id,domain:s.domain,niche:s.niche,market:s.market,locale:s.locale,created_at:s.created_at}));
 return {kind:"ready",sites};
}
export async function addSeoManagedSite(values:{domain:string;niche:string;market:string;locale:string}):Promise<"created"|"invalid"|"unconfigured"|"unavailable"|"unauthorized">{
 if(!values.domain||values.domain.length>253||values.niche.length<2||values.niche.length>120||values.market.length<2||values.market.length>80)return "invalid";
 const response=await callSeo("/v1/sites","POST",values);
 if(response.kind==="ready")return "created";
 return response.kind;
}

/**
 * Only call after a real Search Console API read for a property verified for
 * this exact TAKATAK client workspace. Never accept arbitrary client metrics.
 */
export async function importVerifiedSeoQueries(
  siteId:string,rows:Array<{keyword:string;clicks:number;impressions:number;position:number}>
):Promise<{kind:"imported";count:number}|{kind:"unconfigured"|"unauthorized"|"unavailable";count:0}>{
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(siteId)||!rows.length||rows.length>100)
  return {kind:"unavailable",count:0};
 const response=await callSeo("/v1/sites/"+siteId+"/opportunities/import","POST",{source:"search_console",rows},true);
 if(response.kind!=="ready")return {kind:response.kind,count:0};
 const count=(response.data as {imported?:unknown}).imported;
 if(typeof count!=="number"||!Number.isInteger(count)||count<0||count>100)return {kind:"unavailable",count:0};
 return {kind:"imported",count};
}

export interface SeoEvidenceSummary {
 source:string;provenance:string;period:string;scope:string;countsAreComplete:boolean;
 opportunitiesSampled:number;prospectsSampled:number;briefsSampled:number;clicksInSample:number;
 earnedBacklinksVerified:number;verifiedLinkProviderConfigured:boolean;note:string;
}
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function getSeoEvidenceSummary(siteId:string):Promise<
  {kind:"ready";summary:SeoEvidenceSummary}|{kind:"unavailable"|"unconfigured"|"unauthorized";summary:null}
>{
 if(!UUID_PATTERN.test(siteId))return {kind:"unavailable",summary:null};
 const response=await callSeo("/v1/sites/"+siteId+"/summary","GET");
 if(response.kind!=="ready")return {kind:response.kind,summary:null};
 const value=response.data as {summary?:unknown};
 const summary=value.summary;
 if(!summary||typeof summary!=="object"||!('opportunitiesSampled' in summary)||
   typeof summary.opportunitiesSampled!=="number")return {kind:"unavailable",summary:null};
 return {kind:"ready",summary:summary as SeoEvidenceSummary};
}
/** Download through this trusted server bridge; the browser never sees the signing key. */
export async function downloadSeoOpportunities(siteId:string):Promise<
  {kind:"ready";csv:string}|{kind:"unavailable"|"unconfigured"|"unauthorized";csv:null}
>{
 if(!UUID_PATTERN.test(siteId))return {kind:"unavailable",csv:null};
 const {access}=await getServerAccessContext();
 if(access.mode!=="client_scoped"||!hasEffectivePermission(access,"view_dashboard")||
    !hasEffectivePermission(access,"view_reports"))return {kind:"unauthorized",csv:null};
 const config=configuredEndpoint();
 if(!config)return {kind:"unconfigured",csv:null};
 try {
  const response=await fetch(config.origin+"/v1/sites/"+siteId+"/opportunities.csv",{
   headers:{Authorization:"Bearer "+signWorkspace({
     tenantId:access.activeClientId,profileId:access.profileId,manage:false,ingest:false
   },config.key),Accept:"text/csv"},
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(7000)
  });
  if(!response.ok||!response.headers.get("content-type")?.includes("text/csv"))
   return {kind:response.status===403||response.status===401?"unauthorized":"unavailable",csv:null};
  const csv=await response.text();
  if(csv.length>200_000)return {kind:"unavailable",csv:null};
  return {kind:"ready",csv};
 }catch{return {kind:"unavailable",csv:null};}
}
