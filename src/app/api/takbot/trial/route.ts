import type { NextRequest, NextResponse } from "next/server";

import { json } from "@/lib/ai-credits/http";
import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { createFixedWindowLimiter, hashedClientKey } from "@/lib/security/fixed-window-limiter";
import { readJsonBody } from "@/lib/security/write-request";
import { claimTrial, trialStatus } from "@/lib/takbot/server";
import { recordTrialLead } from "@/lib/takbot/trial-lead";
import { readWebsiteLeadsConfig } from "@/lib/website-leads/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Soft brake on trial farming from one network: a few new trials a day.
const claims = createFixedWindowLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 4 });

const PAGE_RE = /^\/[A-Za-z0-9/_\-.?=&%]{0,200}$/;

/**
 * POST { language?, sourcePage? } — gives the signed-in visitor's own
 * workspace its TAK bot trial credits, once ever, and records the sign-up in
 * the TAKATAK CRM. Same-origin only. Name and email come from the profile
 * row, never from the request.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await readJsonBody(request, 2_048);
  if (!parsed.ok) return json({ ok: false, code: "invalid_request" }, parsed.status);
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const language = body.language === "en" ? "en" : "fr";
  const sourcePage = typeof body.sourcePage === "string" && PAGE_RE.test(body.sourcePage) ? body.sourcePage : null;

  let clientId: string;
  let profile: { email: string | null; name: string | null };
  try {
    const { access, profileDetails } = await getServerAccessContext();
    if (access.mode !== "client_scoped") {
      return json({ ok: false, code: "profileId" in access ? "workspace_required" : "sign_in_required" }, 401);
    }
    if (!hasEffectivePermission(access, "create_content")) return json({ ok: false, code: "forbidden" }, 403);
    clientId = access.activeClientId;
    const name = [profileDetails?.firstName, profileDetails?.lastName].filter(Boolean).join(" ") || profileDetails?.displayName || null;
    profile = { email: profileDetails?.email ?? null, name };
  } catch {
    return json({ ok: false, code: "sign_in_required" }, 401);
  }

  const before = await trialStatus(clientId);
  if (!before.enabled) return json({ ok: false, code: "trial_unavailable", trial: before }, 503);
  if (!before.claimed && !claims.allow(hashedClientKey(request.headers, "takbot-trial"))) {
    return json({ ok: false, code: "rate_limited" }, 429);
  }

  const result = await claimTrial(clientId);
  if (!result.ok) return json({ ok: false, code: result.code }, result.code === "trial_unavailable" ? 503 : 400);

  const leads = readWebsiteLeadsConfig();
  const prisma = getPrisma();
  if (result.granted && leads.enabled && prisma && profile.email) {
    try {
      await recordTrialLead(prisma, {
        agencyClientId: leads.clientId,
        workspaceClientId: clientId,
        email: profile.email,
        name: profile.name,
        language,
        sourcePage,
        credits: before.credits,
      });
    } catch {
      // The credits are granted either way; the CRM card is a convenience.
      console.error("[takbot] trial lead not recorded");
    }
  }

  return json({ ok: true, balance: result.balance, granted: result.granted, trial: { ...before, claimed: true } }, 200);
}
