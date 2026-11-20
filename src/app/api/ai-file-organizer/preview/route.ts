import type { NextRequest } from "next/server";

import { parseOrganizerPreviewRequest } from "@/lib/ai-file-organizer/preview-request";
import { organizerSettingsFromRow } from "@/lib/ai-file-organizer/settings-policy";
import { previewStudioOrganizerAction } from "@/lib/ai-file-organizer/studio-approval";
import { hasOrganizerEntitlement, loadOrganizerStudioOutput } from "@/lib/ai-file-organizer/studio-existing-records";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Preview a HUMAN-selected Studio draft association.
 * This is NOT an AI classifier, persistent approval, publishing operation,
 * file move or billing operation. An authenticated manager must have both
 * create_content and manage_settings, then the real workspace policy is read.
 */
export async function POST(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("create_content");
  if (!gate.ok) return gate.response;
  if (!hasEffectivePermission(gate.access, "manage_settings"))
    return jsonResponse({ ok: false, code: "forbidden" }, 403);

  const input = await readJsonBody(request, 1024);
  if (!input.ok) return jsonResponse({ ok: false, message: input.message }, input.status);
  const parsed = parseOrganizerPreviewRequest(input.body);
  if (!parsed) return jsonResponse({ ok: false, code: "invalid_preview" }, 400);

  const clientId = gate.access.activeClientId;
  if (!await hasOrganizerEntitlement(clientId))
    return jsonResponse({ ok: false, code: "organizer_unavailable" }, 403);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);

  try {
    // Policy read BEFORE source lookup; an opted-out client must not scan drafts.
    const row = await db.organizerWorkspacePolicy.findUnique({ where: { clientId } });
    const settings = organizerSettingsFromRow(row);
    if (settings.mode !== "suggest" || !settings.consentGranted ||
      settings.providerProcessingConsent || !settings.allowedDestinationIds.includes(parsed.destinationProjectId))
      return jsonResponse({ ok: false, code: "organizer_disabled" }, 403);

    const decision = await previewStudioOrganizerAction({
      canManageWorkspace: async id => id === clientId,
      hasOrganizerEntitlement: async id => id === clientId,
      loadStudioOutput: loadOrganizerStudioOutput,
      loadDestination: async (id, destinationId) => {
        const target = await db.savedAiOutput.findFirst({
          where: {
            clientId: id, id: destinationId, status: { not: "archived" },
            metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE },
          },
          select: { clientId: true },
        });
        return target && { clientId: target.clientId };
      },
    }, {
      clientId,
      outputId: parsed.outputId,
      destinationId: parsed.destinationProjectId,
      // The destination was selected by a human; this is NOT an AI confidence score.
      confidence: 1,
      policy: {
        mode: settings.mode,
        consentGranted: settings.consentGranted,
        allowedSourceKinds: settings.allowedSourceKinds,
        allowedDestinationIds: settings.allowedDestinationIds,
        minimumConfidence: settings.minimumConfidence,
        requireApproval: true,
      },
    });
    if (decision !== "approval_required")
      return jsonResponse({ ok: false, code: "preview_not_permitted" }, 404);

    return jsonResponse({
      ok: true,
      decision: "approval_required",
      selectionType: "manual",
      persisted: false,
      providerCalled: false,
      fileMoved: false,
      approved: false,
    }, 200);
  } catch (error) {
    return handleApiError("organizer-preview", error, "Organizer preview is unavailable.");
  }
}
