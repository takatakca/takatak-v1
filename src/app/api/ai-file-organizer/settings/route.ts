import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse, handleApiError } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import { STUDIO_PROJECT_SOURCE } from "@/lib/studio/production";
import { hasOrganizerEntitlement } from "@/lib/ai-file-organizer/studio-existing-records";
import { defaultOrganizerSettings, organizerSettingsFromRow, parseOrganizerSettingsUpdate } from "@/lib/ai-file-organizer/settings-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireWorkspaceApiPermission("manage_settings");
  if (!gate.ok) return gate.response;
  const clientId = gate.access.activeClientId;
  if (!await hasOrganizerEntitlement(clientId)) return jsonResponse({ ok: false, code: "organizer_unavailable" }, 403);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  try {
    const [row, availableProjects] = await Promise.all([
      db.organizerWorkspacePolicy.findUnique({ where: { clientId } }),
      db.savedAiOutput.findMany({
        where: { clientId, status: { not: "archived" },
          metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE } },
        select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 50,
      }),
    ]);
    return jsonResponse({ ok: true, settings: organizerSettingsFromRow(row ?? null),
      availableProjects, initial: row === null,
      storageMode: "studio_metadata_only", fileMovesEnabled: false }, 200);
  } catch (error) { return handleApiError("organizer-policy-get", error, "Organizer settings are unavailable."); }
}

/** No automatic mode, provider call, file move or customer workspace creation here. */
export async function PUT(request: NextRequest) {
  const gate = await requireWorkspaceApiPermission("manage_settings");
  if (!gate.ok) return gate.response;
  const clientId = gate.access.activeClientId;
  if (!await hasOrganizerEntitlement(clientId)) return jsonResponse({ ok: false, code: "organizer_unavailable" }, 403);
  const body = await readJsonBody(request, 4096);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  const input = parseOrganizerSettingsUpdate(body.body);
  if (!input) return jsonResponse({ ok: false, code: "invalid_policy" }, 400);
  const db = getPrisma();
  if (!db) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  try {
    if (input.mode !== "off") {
      const count = await db.savedAiOutput.count({
        where: { clientId, id: { in: input.allowedDestinationIds }, status: { not: "archived" },
          metadata: { path: ["source"], equals: STUDIO_PROJECT_SOURCE } },
      });
      if (count !== input.allowedDestinationIds.length)
        return jsonResponse({ ok: false, code: "destination_not_found" }, 404);
    }
    const data = { mode: input.mode, consentGranted: input.consentGranted,
      providerProcessingConsent: input.providerProcessingConsent,
      allowedSourceKinds: input.allowedSourceKinds, allowedDestinationIds: input.allowedDestinationIds,
      minimumConfidence: input.minimumConfidence, requireApproval: true,
      updatedBy: gate.access.profileId };
    const row = await db.$transaction(async tx => {
      const current = await tx.organizerWorkspacePolicy.findUnique({ where: { clientId },
        select: { revision: true } });
      if (current && current.revision !== input.expectedRevision) return null;
      if (!current && input.expectedRevision !== 0) return null;
      // Version-bound compare-and-swap: concurrent managers cannot overwrite each other.
      const saved = current
        ? await (async () => {
            const changed = await tx.organizerWorkspacePolicy.updateMany({
              where: { clientId, revision: input.expectedRevision },
              data: { ...data, revision: { increment: 1 } },
            });
            return changed.count === 1
              ? tx.organizerWorkspacePolicy.findUnique({ where: { clientId } })
              : null;
          })()
        : await tx.organizerWorkspacePolicy.create({ data: { clientId, ...data } });
      if (!saved) return null;
      await tx.auditLog.create({ data: { clientId, profileId: gate.access.profileId,
        action: "organizer.policy_updated", entityType: "organizer_workspace_policy", entityId: clientId,
        metadata: { mode: saved.mode, revision: saved.revision, sourceCount: input.allowedSourceKinds.length,
          destinationCount: input.allowedDestinationIds.length } } });
      return saved;
    });
    if (!row) return jsonResponse({ ok: false, code: "policy_conflict" }, 409);
    return jsonResponse({ ok: true, settings: organizerSettingsFromRow(row),
      storageMode: "studio_metadata_only", fileMovesEnabled: false }, 200);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return jsonResponse({ ok: false, code: "policy_conflict" }, 409);
    return handleApiError("organizer-policy-update", error, "Organizer settings could not be saved.");
  }
}
