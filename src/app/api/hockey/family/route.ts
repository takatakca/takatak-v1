import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import {
  ensureDefaultHockeyFamily,
  listAccessibleHockeyFamilies,
} from "@/lib/hockey/family/family-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { hasValidWriteOrigin } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  try {
    const families = await listAccessibleHockeyFamilies(gate.user.id);
    return jsonResponse({ ok: true, families }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-list",
      error,
      "Hockey family data could not be loaded.",
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidWriteOrigin(request)) {
    return jsonResponse(
      { ok: false, message: "The request origin could not be verified." },
      403,
    );
  }

  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  try {
    const family = await ensureDefaultHockeyFamily(gate.user.id);
    return jsonResponse({ ok: true, family }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-bootstrap",
      error,
      "Hockey family could not be initialized.",
    );
  }
}
