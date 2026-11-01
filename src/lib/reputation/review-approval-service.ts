import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { QMAPS_BUSINESS_ID } from "@/lib/qmaps/bridge";
import {
  canonicalReviewReply,
  resolveReviewTarget,
  reviewReplyHash,
} from "./review-target";
import type { ReviewDraftSource } from "./review-target-model";
export type ReviewApprovalRun = {
  id: string;
  reviewId: string | null;
  source: ReviewDraftSource;
  author: string;
  location: string;
  reviewText: string | null;
  rating: number | null;
  status: string;
  draft: string | null;
  draftHash: string | null;
  creditsDebited: number;
  createdAt: string;
  decidedAt: string | null;
  error: string | null;
  publishedAt: string | null;
  blockedReason?: string | null;
};
export type ReviewDraftDecisionState =
  { ok: null } | { ok: false; error: string } | { ok: true; message: string };
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
function sourceOf(input: Record<string, unknown>): ReviewDraftSource | null {
  return input.source === "google" || input.source === "qmaps"
    ? input.source
    : input.source === undefined || input.source === "takatak"
      ? "takatak"
      : null;
}
const hash = (updatedAt: Date, reply: string | null, input: unknown) =>
  reviewReplyHash(JSON.stringify([updatedAt.toISOString(), reply, input]));
const SHA256 = /^[a-f0-9]{64}$/;
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));
export async function getReviewApprovals(
  clientId: string,
  database?: PrismaClient,
): Promise<ReviewApprovalRun[]> {
  if (!QMAPS_BUSINESS_ID.test(clientId)) throw new Error("invalid_workspace");
  const db = database ?? getPrisma();
  if (!db) throw new Error("database_unavailable");
  const rows = await db.aiAgentRun.findMany({
    where: { clientId, agentKey: "review_responder" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      status: true,
      input: true,
      output: true,
      creditsDebited: true,
      createdAt: true,
      updatedAt: true,
      decidedAt: true,
      error: true,
    },
  });
  return Promise.all(
    rows.map(async (row) => {
      const input = object(row.input),
        source = sourceOf(input),
        id =
          typeof input.reviewResponseId === "string"
            ? input.reviewResponseId
            : null;
      const current =
        source && id
          ? await resolveReviewTarget(db, clientId, source, id)
          : null;
      const output = object(row.output),
        approval = object(input.reviewApproval),
        frozen = source
          ? canonicalReviewReply(source, approval.replyText)
          : null,
        reply =
          frozen && reviewReplyHash(frozen) === approval.replyHash
            ? frozen
            : source
              ? canonicalReviewReply(source, output.reply)
              : null,
        publication = object(input.reviewPublication);
      const changed =
        !!current &&
        input.reviewWorkflowVersion === 2 &&
        input.reviewContentHash !== current.fingerprint;
      const blockedReason = !current
        ? "L’avis source n’est plus accessible dans cet espace."
        : changed
          ? "L’avis a changé depuis la demande. Générez un nouveau brouillon."
          : !reply
            ? "Aucun texte de réponse valide n’a été retourné."
            : null;
      let publishedAt: string | null = null;
      // This server-owned receipt outlives source removal and worker output reports.
      // A current source row is needed only to reconcile an interrupted request.
      const hasApproval =
        input.reviewApproval !== undefined && input.reviewApproval !== null;
      const boundReceipt =
        (source === "google" || source === "qmaps") &&
        typeof id === "string" &&
        QMAPS_BUSINESS_ID.test(id) &&
        publication.source === source &&
        publication.reviewId === id &&
        typeof publication.attemptId === "string" &&
        QMAPS_BUSINESS_ID.test(publication.attemptId) &&
        typeof publication.replyHash === "string" &&
        SHA256.test(publication.replyHash) &&
        typeof publication.targetHash === "string" &&
        SHA256.test(publication.targetHash) &&
        validDate(publication.at) &&
        (!reply || reviewReplyHash(reply) === publication.replyHash) &&
        (!hasApproval ||
          (approval.replyHash === publication.replyHash &&
            approval.targetHash === publication.targetHash)) &&
        (input.reviewWorkflowVersion !== 2 ||
          (!!frozen && reviewReplyHash(frozen) === publication.replyHash));
      if (
        boundReceipt &&
        publication.state === "confirmed" &&
        validDate(publication.confirmedAt)
      ) {
        publishedAt = publication.confirmedAt;
      } else if (
        boundReceipt &&
        current?.replyAt &&
        current.replyText &&
        validDate(current.replyAt) &&
        validDate(publication.at) &&
        Date.parse(current.replyAt) >= Date.parse(publication.at) &&
        reviewReplyHash(
          canonicalReviewReply(source!, current.replyText) || "",
        ) === publication.replyHash
      ) {
        publishedAt = current.replyAt;
      }
      return {
        id: row.id,
        reviewId: current?.id ?? null,
        source: source ?? "takatak",
        author: current?.author ?? "Avis indisponible",
        location: current?.location ?? "Source indisponible",
        reviewText: current?.text.slice(0, 4000) ?? null,
        rating: current?.rating ?? null,
        status: row.status,
        draft: reply,
        draftHash: hash(row.updatedAt, reply, row.input),
        creditsDebited: row.creditsDebited,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        error: row.error
          ? "Le traitement a échoué. Consultez le suivi IA avant de réessayer."
          : null,
        publishedAt,
        blockedReason: publishedAt ? null : blockedReason,
      };
    }),
  );
}

export async function decideReviewDraft(
  clientId: string,
  profileId: string,
  runId: string,
  decision: "approve" | "reject",
  expectedHash: string,
  database?: PrismaClient,
): Promise<ReviewDraftDecisionState> {
  if (
    ![clientId, profileId, runId].every((id) => QMAPS_BUSINESS_ID.test(id)) ||
    !["approve", "reject"].includes(decision) ||
    !/^[a-f0-9]{64}$/.test(expectedHash)
  )
    return { ok: false, error: "Choisissez un brouillon valide." };
  const db = database ?? getPrisma();
  if (!db) return { ok: false, error: "La base de réponses est indisponible." };
  return db.$transaction(async (tx) => {
    const row = await tx.aiAgentRun.findFirst({
      where: {
        id: runId,
        clientId,
        agentKey: "review_responder",
        status: "awaiting_approval",
      },
      select: {
        id: true,
        status: true,
        input: true,
        output: true,
        updatedAt: true,
      },
    });
    if (!row)
      return {
        ok: false as const,
        error: "Cette demande n’attend plus une décision.",
      };
    const input = object(row.input),
      source = sourceOf(input),
      reply = source
        ? canonicalReviewReply(source, object(row.output).reply)
        : null;
    if (hash(row.updatedAt, reply, row.input) !== expectedHash)
      return {
        ok: false as const,
        error: "Le brouillon a changé. Actualisez avant de décider.",
      };
    const current =
      source && typeof input.reviewResponseId === "string"
        ? await resolveReviewTarget(
            tx,
            clientId,
            source,
            input.reviewResponseId,
          )
        : null;
    if (
      decision === "approve" &&
      (!current ||
        !reply ||
        (input.reviewWorkflowVersion === 2 &&
          input.reviewContentHash !== current.fingerprint))
    )
      return {
        ok: false as const,
        error:
          "L’avis ou le texte n’est plus valide. Actualisez ou rejetez ce brouillon.",
      };
    const now = new Date();
    const internal = source === "takatak";
    const next =
      decision === "reject" ? "rejected" : internal ? "completed" : "approved";
    const updated = await tx.aiAgentRun.updateMany({
      where: {
        id: runId,
        clientId,
        agentKey: "review_responder",
        status: "awaiting_approval",
        updatedAt: row.updatedAt,
      },
      data: {
        status: next,
        decidedByProfileId: profileId,
        decidedAt: now,
        ...(next === "completed" || next === "rejected"
          ? { completedAt: now }
          : {}),
        ...(decision === "approve"
          ? {
              input: {
                ...input,
                reviewApproval: {
                  replyText: reply,
                  replyHash: reviewReplyHash(reply!),
                  targetHash: current!.fingerprint,
                  at: now.toISOString(),
                  profileId,
                },
              } as Prisma.InputJsonObject,
            }
          : {}),
      },
    });
    if (updated.count !== 1)
      return {
        ok: false as const,
        error: "Une autre décision a déjà été enregistrée.",
      };
    await tx.auditLog.create({
      data: {
        clientId,
        profileId,
        action: `reputation.draft.${decision}`,
        entityType: "ai_agent_run",
        entityId: runId,
        metadata: {
          source: source ?? "unknown",
          decision,
          replyHash: reply ? reviewReplyHash(reply) : null,
        },
      },
    });
    return {
      ok: true as const,
      message:
        decision === "reject"
          ? "Brouillon rejeté; aucune réponse n’a été publiée."
          : internal
            ? "Brouillon validé pour le suivi interne; aucune réponse publique n’est envoyée."
            : "Texte approuvé. Le service de traitement configuré peut l’exécuter; la publication n’est pas encore confirmée.",
    };
  });
}
