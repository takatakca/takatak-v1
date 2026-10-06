import { NextRequest, NextResponse } from "next/server";

import { publicAppOrigin } from "@/lib/growth/public-origin";
import { completeGoogleBusinessConnect } from "@/lib/integrations/google-business/service";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACK = "/dashboard/growth/reviews";

/** Google OAuth redirect target. The signed-in user must be the one who started the flow. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = await publicAppOrigin();
  const back = (status: string) => NextResponse.redirect(`${origin}${BACK}?google=${encodeURIComponent(status)}`, 303);
  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back("denied");
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";
  if (!code || !state || code.length > 2048 || state.length > 256) return back("invalid");

  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "manage_reputation")) return back("forbidden");
  try {
    const result = await completeGoogleBusinessConnect({ state, code, clientId: access.activeClientId, profileId: access.profileId, origin });
    return back(result.ok ? "connected" : result.reason);
  } catch {
    console.error("[google-business] callback failed");
    return back("error");
  }
}
