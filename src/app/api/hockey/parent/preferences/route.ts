import { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import { hockeyMembershipAllows } from "@/lib/billing/hockey/membership-policy";
import {
  enabledPreferenceFeatures,
  validateHockeyParentPreferenceInput,
} from "@/lib/billing/hockey/parent-preference-policy";
import {
  listHockeyParentTeamPreferences,
  saveHockeyParentTeamPreference,
} from "@/lib/billing/hockey/parent-preference-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireIdentityUser() {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false as const,
      response: jsonResponse({ ok: false, message: "Sign in to continue." }, 401),
    };
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return {
      ok: false as const,
      response: jsonResponse(
        { ok: false, message: "Your TAKATAK identity could not be verified." },
        403,
      ),
    };
  }

  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return {
      ok: false as const,
      response: jsonResponse(
        { ok: false, message: "TAKATAK identity is temporarily unavailable." },
        503,
      ),
    };
  }

  return { ok: true as const, user };
}

export async function GET() {
  const gate = await requireIdentityUser();
  if (!gate.ok) return gate.response;

  try {
    const preferences = await listHockeyParentTeamPreferences(gate.user.id);
    return jsonResponse({ ok: true, preferences }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-parent-preferences-read",
      error,
      "Parent hockey preferences could not be loaded.",
    );
  }
}

export async function PUT(request: NextRequest) {
  const gate = await requireIdentityUser();
  if (!gate.ok) return gate.response;

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateHockeyParentPreferenceInput(bodyResult.body);
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

  const enabledFeatures = enabledPreferenceFeatures(validation.data);

  if (enabledFeatures.length > 0) {
    const membership = await getHockeyMembershipSnapshot(gate.user.id);

    const missing = enabledFeatures.filter(
      (feature) =>
        !hockeyMembershipAllows(
          {
            status: membership.status,
            planCode: membership.planCode,
          },
          feature,
        ),
    );

    if (missing.length > 0) {
      return jsonResponse(
        {
          ok: false,
          code: "premium_required",
          message:
            "An active AHMV Parent Premium membership is required to enable these services.",
          missingFeatures: missing,
        },
        402,
      );
    }
  }

  try {
    const preference = await saveHockeyParentTeamPreference(
      gate.user.id,
      validation.data,
    );
    return jsonResponse({ ok: true, preference }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-parent-preferences-write",
      error,
      "Parent hockey preferences could not be saved.",
    );
  }
}
