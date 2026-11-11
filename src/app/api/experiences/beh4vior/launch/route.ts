import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { createBeh4viorExperienceLaunch } from "@/lib/experiences/beh4vior-experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state") || "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
    return jsonResponse({ ok:false, message:"Invalid BEH4VIOR launch state." },400);
  }
  const user=await getSessionUser();
  if(!user){
    const next="/api/experiences/beh4vior/launch?state="+encodeURIComponent(state);
    return NextResponse.redirect(new URL("/login?next="+encodeURIComponent(next),request.url));
  }
  const sync=await ensureProfileForSupabaseUser(user,{createPersonalWorkspace:false});
  if(sync.outcome==="denied")return jsonResponse({ok:false,message:"BEH4VIOR access denied."},403);
  if(sync.outcome==="unavailable" || sync.outcome==="error")
    return jsonResponse({ok:false,message:"TAKATAK identity temporarily unavailable."},503);
  try{
    const url=await createBeh4viorExperienceLaunch(user.id,state);
    const response=NextResponse.redirect(url,303);
    response.headers.set("Cache-Control","no-store");
    response.headers.set("Referrer-Policy","no-referrer");
    return response;
  }catch(error){return handleApiError("beh4vior-launch",error,"BEH4VIOR launch failed.");}
}
