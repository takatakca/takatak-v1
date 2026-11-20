/** Pure, bounded agent/scenes policy. A plan never grants publication authority. */
export const STUDIO_AGENT_SOURCE = "takatakstudio_agent_v1";
export const STUDIO_SCENE_SOURCE = "takatakstudio_scenes_v1";
export type AgentTrack = "video" | "book" | "music" | "social";
export type Scene = { title: string; visual: string; narration: string; seconds: number };
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function bounded(value: unknown, max: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
export function parseScenes(value: unknown): Scene[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return null;
  const scenes: Scene[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const s = raw as Record<string, unknown>;
    if (!bounded(s.title, 70) || !bounded(s.visual, 500) || typeof s.narration !== "string" || s.narration.length > 800 ||
        typeof s.seconds !== "number" || !Number.isInteger(s.seconds) || s.seconds < 2 || s.seconds > 30) return null;
    scenes.push({title:s.title.trim(),visual:s.visual.trim(),narration:s.narration,seconds:s.seconds});
  }
  return scenes.reduce((sum,s)=>sum+s.seconds,0) <= 180 ? scenes : null;
}
export type AgentPlan = { projectId:string; requestId:string; tracks:AgentTrack[]; days:number; budgetCredits:number; engine:"auto"|"ollama" };
export function parseAgentPlan(value:unknown, perDraft:number):AgentPlan|null {
  if (!value || typeof value!=="object" || Array.isArray(value)) return null;
  const v=value as Record<string,unknown>;
  if(typeof v.projectId!=="string" || !UUID.test(v.projectId) || typeof v.requestId!=="string" || !UUID.test(v.requestId) ||
     !Array.isArray(v.tracks) || !v.tracks.length || v.tracks.length>4 || v.tracks.some(t=>!["video","book","music","social"].includes(t)) ||
     new Set(v.tracks).size!==v.tracks.length || typeof v.days!=="number" || !Number.isInteger(v.days) || v.days<1 || v.days>7 ||
     typeof v.budgetCredits!=="number" || !Number.isSafeInteger(v.budgetCredits) || v.budgetCredits<1 || v.budgetCredits>1000 ||
     !Number.isSafeInteger(perDraft) || perDraft<1 || v.days*v.tracks.length*perDraft>v.budgetCredits ||
     (v.engine!=="auto" && v.engine!=="ollama")) return null;
  return {projectId:v.projectId,requestId:v.requestId,tracks:v.tracks as AgentTrack[],days:v.days,budgetCredits:v.budgetCredits,engine:v.engine};
}
export function planSteps(plan:AgentPlan, startMs:number) {
  return Array.from({length:plan.days},(_,day)=>plan.tracks.map(track=>({day,track,dueAt:new Date(startMs+day*86400000).toISOString()}))).flat();
}
export function canHandoff(input:{track:unknown;outputClientId:string;accountClientId:string;clientId:string;outputStatus:string;accountStatus:string;platform:string;content:string}) {
  return input.track==="social" && input.outputClientId===input.clientId && input.accountClientId===input.clientId &&
    ["draft","saved","sent_to_approval"].includes(input.outputStatus) && input.accountStatus==="connected" &&
    ["facebook","instagram","youtube","tiktok","linkedin","threads","pinterest","bluesky"].includes(input.platform) &&
    input.content.trim().length>0 && input.content.length<=8000;
}
/** Secure unique operation ID, including browser previews without randomUUID(). */
export function newStudioRequestId(random:Pick<Crypto,"getRandomValues">=crypto):string {
  const b=random.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=Array.from(b,n=>n.toString(16).padStart(2,"0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
