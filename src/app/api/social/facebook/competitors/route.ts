import { NextRequest } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContext } from "@/lib/security/brand-context";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { resolveCanonicalFacebookDashboard } from "@/lib/social/connections/facebook-dashboard-resolve";
import { getPrisma } from "@/lib/db/prisma";
import { isServiceError } from "@/lib/services/service-error";
import { FACEBOOK_COMPETITOR_CAPABILITY_MATRIX } from "@/lib/social/providers/meta-competitors";
import { assertCompetitorRateLimit } from "@/lib/social/sync/facebook-competitor-rate-limit";
import {
  addFacebookCompetitor,
  buildCompetitorBenchmark,
  listFacebookCompetitors,
} from "@/lib/social/sync/facebook-competitor-sync";
import { resolveLifetimeFollowersSnapshot } from "@/lib/social/sync/facebook-page-initial-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/social/facebook/competitors
 * Lists brand-scoped competitors + capability probe. Never exposes provider IDs.
 */
export async function GET() {
  try {
    const gate = await requireWorkspaceApiPermission("view_social");
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContext(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        {
          ok: true,
          capability: null,
          competitors: [],
          notice: "Select a brand to manage competitors.",
        },
        200,
      );
    }

    const limited = assertCompetitorRateLimit({
      profileId: gate.access.profileId,
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      action: "list",
    });
    if (!limited.ok) {
      return jsonResponse({ ok: false, message: limited.message }, 429);
    }

    const listed = await listFacebookCompetitors({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    const resolved = await resolveCanonicalFacebookDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let selectedFollowers: number | null = null;
    let selectedFollowersAsOf: string | null = null;
    let selectedLabel = "Selected Page";
    if (resolved.kind === "ready") {
      selectedLabel = resolved.pageName;
      const lifetime = await resolveLifetimeFollowersSnapshot({
        clientId: gate.access.activeClientId,
        businessBrandId: brand.activeBrandId,
        socialAccountId: resolved.socialAccountId,
        atOrBefore: new Date().toISOString().slice(0, 10),
      });
      selectedFollowers = lifetime?.value ?? null;
      selectedFollowersAsOf = lifetime?.date ?? null;
    }

    const benchmark = buildCompetitorBenchmark({
      selectedLabel,
      selectedFollowers,
      selectedFollowersAsOf,
      competitors: listed.competitors,
    });

    return jsonResponse(
      {
        ok: true,
        capability: listed.capability,
        competitors: listed.competitors,
        benchmark,
        matrix: FACEBOOK_COMPETITOR_CAPABILITY_MATRIX,
        selectedPage: {
          label: selectedLabel,
          // Never include socialAccountId / connectionId / Page id.
          hasSelection: resolved.kind === "ready",
        },
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-competitors-get",
      error,
      "Competitors could not be loaded.",
    );
  }
}

/**
 * POST /api/social/facebook/competitors
 * Body: { input: string, displayLabel?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireWorkspaceApiPermission(
      "manage_social_accounts",
    );
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContext(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        { ok: false, message: "Select a brand before adding competitors." },
        400,
      );
    }

    const limited = assertCompetitorRateLimit({
      profileId: gate.access.profileId,
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      action: "add",
    });
    if (!limited.ok) {
      return jsonResponse({ ok: false, message: limited.message }, 429);
    }

    const body = (await request.json().catch(() => null)) as {
      input?: unknown;
      displayLabel?: unknown;
    } | null;
    const input = typeof body?.input === "string" ? body.input : "";
    const displayLabel =
      typeof body?.displayLabel === "string" ? body.displayLabel : null;

    const resolved = await resolveCanonicalFacebookDashboard({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
    });

    let selectedExternalPageId: string | null = null;
    if (resolved.kind === "ready") {
      const prisma = getPrisma();
      const account = prisma
        ? await prisma.socialAccount.findFirst({
            where: {
              id: resolved.socialAccountId,
              clientId: gate.access.activeClientId,
            },
            select: { externalAccountId: true },
          })
        : null;
      selectedExternalPageId = account?.externalAccountId ?? null;
    }

    const row = await addFacebookCompetitor({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      input,
      selectedExternalPageId,
      displayLabel,
    });

    return jsonResponse({ ok: true, competitor: row }, 201);
  } catch (error) {
    if (isServiceError(error)) {
      return jsonResponse(
        { ok: false, message: error.message, category: error.code },
        error.status,
      );
    }
    return handleApiError(
      "facebook-competitors-post",
      error,
      "Competitor could not be added.",
    );
  }
}
