import { NextRequest } from "next/server";

import { requireHockeyFamilyApiUser } from "@/lib/hockey/family/api-auth";
import { getHockeyFamilySchedule } from "@/lib/hockey/family/family-service";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 120 * DAY_MS;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ familyId: string }> },
) {
  const gate = await requireHockeyFamilyApiUser();
  if (!gate.ok) return gate.response;

  const { familyId } = await context.params;
  if (!isUuid(familyId)) {
    return jsonResponse(
      { ok: false, message: "Invalid family identifier." },
      400,
    );
  }

  const url = new URL(request.url);
  const now = new Date();
  const from = parseDate(url.searchParams.get("from")) ?? now;
  const to =
    parseDate(url.searchParams.get("to")) ??
    new Date(from.getTime() + 21 * DAY_MS);

  if (
    to.getTime() < from.getTime() ||
    to.getTime() - from.getTime() > MAX_WINDOW_MS
  ) {
    return jsonResponse(
      {
        ok: false,
        message: "Schedule window must be between 0 and 120 days.",
      },
      400,
    );
  }

  try {
    const schedule = await getHockeyFamilySchedule({
      authUserId: gate.user.id,
      familyId,
      from,
      to,
    });
    return jsonResponse({ ok: true, schedule }, 200);
  } catch (error) {
    return handleApiError(
      "hockey-family-schedule",
      error,
      "Family hockey schedule could not be loaded.",
    );
  }
}
