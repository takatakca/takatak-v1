import type { NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { startSeoAudit } from "@/lib/seo/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REFUSALS = {
  invalid_host: { status: 400, message: "Choose one of this workspace's websites." },
  not_workspace_site: { status: 403, message: "Only this workspace's own websites can be audited." },
  busy: { status: 409, message: "An audit is already running for this workspace. Try again in a few minutes." },
  daily_limit: { status: 429, message: "Daily audit limit reached for this workspace." },
} as const;

/** Runs a technical SEO audit of one of the active workspace's websites. */
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_brands");
  if (!gate.ok) return gate.response;

  const body = await readJsonBody(request, 2_048);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);

  const host =
    body.body && typeof body.body === "object" && !Array.isArray(body.body) &&
    typeof (body.body as Record<string, unknown>).host === "string"
      ? ((body.body as Record<string, unknown>).host as string).slice(0, 300)
      : "";

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, message: "SEO audits are temporarily unavailable." }, 503);

  try {
    const result = await startSeoAudit(prisma, {
      clientId: gate.access.activeClientId,
      profileId: gate.access.profileId,
      host,
    });
    if (!result.ok) {
      const refusal = REFUSALS[result.reason];
      return jsonResponse({ ok: false, message: refusal.message }, refusal.status);
    }
    return jsonResponse(
      { ok: true, auditId: result.auditId, status: result.status, score: result.score },
      200,
    );
  } catch (error) {
    return handleApiError("seo-audit", error, "The SEO audit could not be started.");
  }
}
