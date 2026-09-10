import { NextRequest } from "next/server";

import {
  handleApiError,
  jsonResponse,
} from "@/lib/security/api-response";
import { resolveBrandSessionContextFromRequest } from "@/lib/security/brand-request";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { isServiceError } from "@/lib/services/service-error";
import { assertCompetitorRateLimit } from "@/lib/social/sync/facebook-competitor-rate-limit";
import {
  removeFacebookCompetitor,
  renameFacebookCompetitor,
} from "@/lib/social/sync/facebook-competitor-sync";
import { enqueueFacebookCompetitorRefresh } from "@/lib/social/sync/facebook-competitor-sync-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ publicRef: string }>;
};

/**
 * PATCH /api/social/facebook/competitors/[publicRef]
 * Rename local display label only.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireWorkspaceApiPermission(
      "manage_social_accounts",
    );
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        { ok: false, message: "Select a brand first." },
        400,
      );
    }

    const { publicRef } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      displayLabel?: unknown;
    } | null;
    const displayLabel =
      typeof body?.displayLabel === "string" ? body.displayLabel : null;

    await renameFacebookCompetitor({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      publicRef,
      displayLabel,
    });

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (isServiceError(error)) {
      return jsonResponse(
        { ok: false, message: error.message, category: error.code },
        error.status,
      );
    }
    return handleApiError(
      "facebook-competitors-patch",
      error,
      "Competitor could not be updated.",
    );
  }
}

/**
 * DELETE /api/social/facebook/competitors/[publicRef]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireWorkspaceApiPermission(
      "manage_social_accounts",
    );
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        { ok: false, message: "Select a brand first." },
        400,
      );
    }

    const { publicRef } = await context.params;
    await removeFacebookCompetitor({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      publicRef,
    });

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (isServiceError(error)) {
      return jsonResponse(
        { ok: false, message: error.message, category: error.code },
        error.status,
      );
    }
    return handleApiError(
      "facebook-competitors-delete",
      error,
      "Competitor could not be removed.",
    );
  }
}

/**
 * POST /api/social/facebook/competitors/[publicRef]
 * Enqueue durable refresh (never refreshes on GET).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const gate = await requireWorkspaceApiPermission(
      "manage_social_accounts",
    );
    if (!gate.ok) return gate.response;

    const brand = await resolveBrandSessionContextFromRequest(gate.access);
    if (!brand.activeBrandId) {
      return jsonResponse(
        { ok: false, message: "Select a brand first." },
        400,
      );
    }

    const limited = assertCompetitorRateLimit({
      profileId: gate.access.profileId,
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      action: "refresh",
    });
    if (!limited.ok) {
      return jsonResponse({ ok: false, message: limited.message }, 429);
    }

    const { publicRef } = await context.params;
    const result = await enqueueFacebookCompetitorRefresh({
      clientId: gate.access.activeClientId,
      businessBrandId: brand.activeBrandId,
      publicRef,
    });

    return jsonResponse(
      {
        ok: true,
        enqueued: result.enqueued,
        notice: result.enqueued
          ? "Competitor refresh queued. Prior confirmed snapshots stay visible."
          : "A refresh is already queued for this competitor.",
      },
      200,
    );
  } catch (error) {
    return handleApiError(
      "facebook-competitors-refresh",
      error,
      "Competitor refresh could not be queued.",
    );
  }
}
