import { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import {
  clearHockeyTravelProfile,
  getHockeyTravelProfile,
  saveHockeyTravelProfile,
} from "@/lib/hockey/travel/travel-profile-service";
import { validateHockeyTravelProfileInput } from "@/lib/hockey/travel/travel-profile-policy";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin, readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireUser() {
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
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getHockeyTravelProfile(gate.user.id);
    return jsonResponse({ ok: true, profile }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-travel-profile-read",
      error,
      "Smart-departure settings could not be loaded.",
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const membership = await getHockeyMembershipSnapshot(gate.user.id);
  if (!membership.features.includes("smart_departure")) {
    return jsonResponse(
      {
        ok: false,
        code: "premium_required",
        message:
          "An active AHMV Parent Premium entitlement is required for smart departure alerts.",
      },
      402,
    );
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    return jsonResponse(
      { ok: false, message: bodyResult.message },
      bodyResult.status,
    );
  }

  const validation = validateHockeyTravelProfileInput(bodyResult.body);
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
    const profile = await saveHockeyTravelProfile(
      gate.user.id,
      validation.data,
    );
    return jsonResponse({ ok: true, profile }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-travel-profile-write",
      error,
      "Smart-departure settings could not be saved.",
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  try {
    const result = await clearHockeyTravelProfile(gate.user.id);
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-travel-profile-delete",
      error,
      "Smart-departure settings could not be cleared.",
    );
  }
}
