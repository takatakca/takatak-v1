import type { Prisma } from "@prisma/client";
import type { StudioTrack } from "./production";

/** Preserve the central engine/trial/request evidence while tagging an owned output. */
export async function linkStudioOutput(tx: Prisma.TransactionClient, input: { clientId: string; outputId: string; projectId: string; track: StudioTrack; outputSource: string }) {
  const { clientId, outputId, projectId, track, outputSource } = input;
  await tx.$queryRaw`SELECT id FROM saved_ai_outputs WHERE id=${outputId}::uuid AND "clientId"=${clientId}::uuid FOR UPDATE`;
  const row = await tx.savedAiOutput.findFirst({ where: { id: outputId, clientId, origin: "ai_generated" }, select: { metadata: true, status: true } });
  if (!row?.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) return false;
  const original = row.metadata as Prisma.InputJsonObject;
  if (original.source === outputSource && original.projectId === projectId && original.track === track && ["draft", "saved", "sent_to_approval"].includes(row.status)) return true;
  if (original.source !== "takbot" || row.status !== "saved") return false;
  const result = await tx.savedAiOutput.updateMany({
    where: { id: outputId, clientId, origin: "ai_generated", status: "saved", metadata: { path: ["source"], equals: "takbot" } },
    data: { status: "draft", metadata: { ...original, source: outputSource, originSource: "takbot", version: 1, projectId, track, generatedBy: "takbot", knowledge: "not_retrieved" } },
  });
  return result.count === 1;
}
