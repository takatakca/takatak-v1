import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { QMAPS_BUSINESS_ID } from "@/lib/qmaps/bridge";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export async function enqueueCanonicalReviewRun(
  db: PrismaClient,
  clientId: string,
  payload: Record<string, string | number>,
  profileId: string | null,
  trigger = "review_cockpit",
): Promise<
  | { ok: true; runId: string }
  | { ok: false; error: "agent_disabled" | "already_pending" | "unknown_agent" }
> {
  if (
    !QMAPS_BUSINESS_ID.test(clientId) ||
    (profileId !== null && !QMAPS_BUSINESS_ID.test(profileId)) ||
    typeof payload.reviewResponseId !== "string" ||
    !QMAPS_BUSINESS_ID.test(payload.reviewResponseId) ||
    !["google", "qmaps", "takatak"].includes(String(payload.source)) ||
    payload.reviewWorkflowVersion !== 2 ||
    typeof payload.reviewContentHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(payload.reviewContentHash)
  )
    return { ok: false, error: "unknown_agent" };
  return db.$transaction(async (tx) => {
    // Lock the existing per-client agent setting: all version2 review producers share this short lock.
    const settings = await tx.$queryRaw<
      Array<{ enabled: boolean }>
    >`SELECT "enabled" FROM "ai_agent_settings" WHERE "clientId" = ${clientId}::uuid AND "agentKey" = 'review_responder' FOR UPDATE`;
    if (!settings[0]?.enabled)
      return { ok: false as const, error: "agent_disabled" as const };
    const pending = await tx.aiAgentRun.findMany({
      where: {
        clientId,
        agentKey: "review_responder",
        status: {
          in: [
            "queued",
            "running",
            "awaiting_approval",
            "approved",
            "executing",
          ],
        },
      },
      select: { id: true, input: true },
      take: 50,
    });
    if (
      pending.some((row) => {
        const input = object(row.input);
        return (
          input.reviewResponseId === payload.reviewResponseId &&
          (input.source ?? "takatak") === payload.source
        );
      }) ||
      pending.length >= 50
    )
      return { ok: false as const, error: "already_pending" as const };
    const row = await tx.aiAgentRun.create({
      data: {
        clientId,
        agentKey: "review_responder",
        trigger: trigger.slice(0, 40),
        input: payload as Prisma.InputJsonObject,
        requestedByProfileId: profileId,
      },
      select: { id: true },
    });
    return { ok: true as const, runId: row.id };
  });
}
