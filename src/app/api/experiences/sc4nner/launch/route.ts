import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { createSc4nnerExperienceLaunch } from "@/lib/experiences/sc4nner-experience-access";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state") || "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
    return jsonResponse({ ok:false, message:"Invalid SC4NNER launch state." },400);
  }
  const user=await getSessionUser();
  if(!user){
    const next="/api/experiences/sc4nner/launch?state="+encodeURIComponent(state);
    return NextResponse.redirect(new URL("/login?next="+encodeURIComponent(next),request.url));
  }
  const sync=await ensureProfileForSupabaseUser(user,{createPersonalWorkspace:false});
  if(sync.outcome==="denied")return jsonResponse({ok:false,message:"SC4NNER access denied."},403);
  if(sync.outcome==="unavailable" || sync.outcome==="error")
    return jsonResponse({ok:false,message:"TAKATAK identity temporarily unavailable."},503);
  try{
    const url=await createSc4nnerExperienceLaunch(user.id,state);
    const response=NextResponse.redirect(url,303);
    response.headers.set("Cache-Control","no-store");
    response.headers.set("Referrer-Policy","no-referrer");
    return response;
  }catch(error){return handleApiError("sc4nner-launch",error,"SC4NNER launch failed.");}
}
