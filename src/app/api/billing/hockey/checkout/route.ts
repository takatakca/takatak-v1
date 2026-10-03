import { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { validateHockeyCheckoutInput } from "@/lib/billing/hockey/membership-policy";
import { startHockeyMembershipCheckout } from "@/lib/billing/hockey/stripe-service";
import { originFromRequest } from "@/lib/config/app-origin";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return jsonResponse({ ok: false, message: "Sign in to continue." }, 401);
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return jsonResponse(
      { ok: false, message: "Your TAKATAK identity could not be verified." },
      403,
    );
  }
  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse(
      { ok: false, message: "Membership identity is temporarily unavailable." },
      503,
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateHockeyCheckoutInput(bodyResult.body);
  if (!validation.success) {
    return jsonResponse(
      {
        ok: false,
        message: validation.message,
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  try {
    const result = await startHockeyMembershipCheckout({
      authUserId: user.id,
      planCode: validation.data.planCode,
      requestOrigin: originFromRequest(request),
    });

    return jsonResponse({ ok: true, url: result.url }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-membership-checkout",
      error,
      "AHMV membership checkout could not be started.",
    );
  }
}
