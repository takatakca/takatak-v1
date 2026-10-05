import { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import {
  deleteHockeyTravelOrigin,
  getHockeyTravelOriginSummary,
  saveHockeyTravelOrigin,
  validateHockeyTravelOriginInput,
} from "@/lib/hockey/travel/travel-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import {
  hasValidWriteOrigin,
  readJsonBody,
} from "@/lib/security/write-request";

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
    const travel = await getHockeyTravelOriginSummary(gate.user.id);
    return jsonResponse({ ok: true, travel }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-travel-origin-read",
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

  const gate = await requireIdentityUser();
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return jsonResponse({ ok: false, message: body.message }, body.status);
  }

  const validation = validateHockeyTravelOriginInput(body.body);
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
    const travel = await saveHockeyTravelOrigin(
      gate.user.id,
      validation.data,
    );
    return jsonResponse({ ok: true, travel }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-travel-origin-write",
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

  const gate = await requireIdentityUser();
  if (!gate.ok) return gate.response;

  try {
    const result = await deleteHockeyTravelOrigin(gate.user.id);
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-travel-origin-delete",
      error,
      "Smart-departure settings could not be removed.",
    );
  }
}
