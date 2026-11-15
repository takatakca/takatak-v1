import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { sc4nnerAuthorizeDecision } from "@/lib/experiences/sc4nner-experience-access";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Entry of the SC4NNER bridge. This GET no longer issues a launch code:
// authorization is an explicit step on the authorize page, where the
// identified account (email) is shown before anything is granted
// (owner's order, 2026-11-15). The code is created only by the POST
// confirmation (./confirm) for the account shown on that page.
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
  const decision=sc4nnerAuthorizeDecision({hasUser:true,syncOutcome:sync.outcome});
  if(decision==="denied")return jsonResponse({ok:false,message:"SC4NNER access denied."},403);
  if(decision==="unavailable")
    return jsonResponse({ok:false,message:"TAKATAK identity temporarily unavailable."},503);
  const authorize=new URL("/experiences/sc4nner/authorize",request.url);
  authorize.searchParams.set("state",state);
  const response=NextResponse.redirect(authorize,303);
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
}
