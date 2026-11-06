import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import { clientHasGrowthFeature } from "@/lib/billing/growth/entitlements";
import { getPrisma } from "@/lib/db/prisma";
import { QMAPS_BUSINESS_ID } from "@/lib/qmaps/bridge";
import { reviewDraftVersionHash } from "./review-approval-service";
import {
  publishReviewRunReply,
  type ReviewPublishCode,
  type ReviewPublisherDependencies,
} from "./review-publisher";
import {
  canonicalReviewReply,
  resolveReviewTarget,
  reviewReplyHash,
} from "./review-target";

export type ReviewDraftPublicationState =
  { ok: null } | { ok: false; error: string } | { ok: true; message: string };

export type ReviewNativePublicationResult =
  | { ok: true; runId: string; replayed: boolean; confirmedAt: string }
  | { ok: false; code: ReviewPublishCode };

export interface ReviewNativePublicationDependencies {
  database?: PrismaClient;
  hasFeature?: ReviewPublisherDependencies["hasFeature"];
  publisher?: typeof publishReviewRunReply;
  resolveTarget?: typeof resolveReviewTarget;
  now?: () => Date;
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const HASH = /^[a-f0-9]{64}$/;
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));
const jsonVersion = (value: Prisma.JsonValue | null) => ({
  equals: value === null ? Prisma.AnyNull : (value as Prisma.InputJsonValue),
});

function approvedBinding(inputValue: unknown): {
  source: "google" | "qmaps";
  reviewId: string;
  reply: string;
  replyHash: string;
  targetHash: string;
} | null {
  const input = object(inputValue),
    approval = object(input.reviewApproval),
    source = input.source;
  if (
    input.reviewWorkflowVersion !== 2 ||
    (source !== "google" && source !== "qmaps") ||
    typeof input.reviewResponseId !== "string" ||
    !QMAPS_BUSINESS_ID.test(input.reviewResponseId)
  )
    return null;
  const reply = canonicalReviewReply(source, approval.replyText);
  if (
    !reply ||
    approval.replyHash !== reviewReplyHash(reply) ||
    typeof approval.targetHash !== "string" ||
    !HASH.test(approval.targetHash) ||
    input.reviewContentHash !== approval.targetHash ||
    !date(approval.at) ||
    typeof approval.profileId !== "string" ||
    !QMAPS_BUSINESS_ID.test(approval.profileId)
  )
    return null;
  return {
    source,
    reviewId: input.reviewResponseId,
    reply,
    replyHash: approval.replyHash as string,
    targetHash: approval.targetHash,
  };
}

function confirmedReceipt(
  inputValue: unknown,
  binding: NonNullable<ReturnType<typeof approvedBinding>>,
): string | null {
  const receipt = object(object(inputValue).reviewPublication);
  return receipt.state === "confirmed" &&
    receipt.source === binding.source &&
    receipt.reviewId === binding.reviewId &&
    receipt.replyHash === binding.replyHash &&
    receipt.targetHash === binding.targetHash &&
    typeof receipt.attemptId === "string" &&
    QMAPS_BUSINESS_ID.test(receipt.attemptId) &&
    date(receipt.at) &&
    date(receipt.confirmedAt) &&
    Date.parse(receipt.confirmedAt) >= Date.parse(receipt.at)
    ? receipt.confirmedAt
    : null;
}

/** An explicit browser action claims one frozen approval; the existing publisher owns its source receipt. */
export async function publishApprovedReviewDraft(
  clientId: string,
  profileId: string,
  runId: string,
  expectedDraftHash: string,
  dependencies: ReviewNativePublicationDependencies = {},
): Promise<ReviewNativePublicationResult> {
  if (
    ![clientId, profileId, runId].every((id) => QMAPS_BUSINESS_ID.test(id)) ||
    !HASH.test(expectedDraftHash)
  )
    return { ok: false, code: "invalid_request" };
  const db = dependencies.database ?? getPrisma();
  if (!db) return { ok: false, code: "database_unavailable" };
  const hasFeature = dependencies.hasFeature ?? clientHasGrowthFeature;
  const now = dependencies.now ?? (() => new Date());
  const claimedAt = now();
  const marker = { profileId, claimedAt: claimedAt.toISOString() };
  type Binding = NonNullable<ReturnType<typeof approvedBinding>>;
  type Claim =
    | { ok: false; code: ReviewPublishCode }
    | { ok: true; binding: Binding; confirmedAt: string | null };
  let claim: Claim;
  try {
    if (
      !(await hasFeature(clientId, "reputation")) ||
      !(await hasFeature(clientId, "ai_autopilot"))
    )
      return { ok: false, code: "plan_required" };
    claim = await db.$transaction(async (tx): Promise<Claim> => {
      const row = await tx.aiAgentRun.findFirst({
        where: { id: runId, clientId, agentKey: "review_responder" },
        select: {
          id: true,
          status: true,
          input: true,
          output: true,
          updatedAt: true,
        },
      });
      if (!row) return { ok: false, code: "not_found" };
      const input = object(row.input),
        binding = approvedBinding(row.input);
      if (!binding) return { ok: false, code: "invalid_approval" };
      const confirmedAt = confirmedReceipt(row.input, binding);
      if (confirmedAt) return { ok: true, binding, confirmedAt };
      if (
        input.reviewPublication !== undefined &&
        input.reviewPublication !== null
      )
        return { ok: false, code: "publication_uncertain" };
      if (
        row.status !== "approved" ||
        (input.reviewNativePublication !== undefined &&
          input.reviewNativePublication !== null)
      )
        return { ok: false, code: "not_active" };
      if (
        canonicalReviewReply(binding.source, object(row.output).reply) !==
        binding.reply
      )
        return { ok: false, code: "draft_mismatch" };
      if (
        reviewDraftVersionHash(row.updatedAt, binding.reply, row.input) !==
        expectedDraftHash
      )
        return { ok: false, code: "state_changed" };
      const setting = await tx.aiAgentSetting.findUnique({
        where: {
          clientId_agentKey: { clientId, agentKey: "review_responder" },
        },
        select: { enabled: true },
      });
      if (!setting?.enabled) return { ok: false, code: "agent_disabled" };
      const target = await (dependencies.resolveTarget ?? resolveReviewTarget)(
        tx,
        clientId,
        binding.source,
        binding.reviewId,
      );
      if (
        !target ||
        target.id !== binding.reviewId ||
        target.source !== binding.source
      )
        return { ok: false, code: "target_unavailable" };
      if (target.fingerprint !== binding.targetHash)
        return { ok: false, code: "review_changed" };
      const claimed = await tx.aiAgentRun.updateMany({
        where: {
          id: runId,
          clientId,
          agentKey: "review_responder",
          status: "approved",
          updatedAt: row.updatedAt,
          input: jsonVersion(row.input),
          output: jsonVersion(row.output),
        },
        data: {
          status: "executing",
          claimedAt,
          input: {
            ...input,
            reviewNativePublication: marker,
          } as Prisma.InputJsonObject,
        },
      });
      if (claimed.count !== 1) return { ok: false, code: "state_changed" };
      await tx.auditLog.create({
        data: {
          clientId,
          profileId,
          action: "reputation.publication.requested",
          entityType: "ai_agent_run",
          entityId: runId,
          metadata: {
            source: binding.source,
            reviewId: binding.reviewId,
            replyHash: binding.replyHash,
          },
        },
      });
      return { ok: true, binding, confirmedAt: null };
    });
  } catch {
    return { ok: false, code: "database_unavailable" };
  }
  if (!claim.ok) return claim;
  if (claim.confirmedAt)
    return { ok: true, runId, replayed: true, confirmedAt: claim.confirmedAt };

  let outcome;
  try {
    outcome = await (dependencies.publisher ?? publishReviewRunReply)(
      runId,
      claim.binding.reply,
      {
        database: db,
        hasFeature,
        resolveTarget: dependencies.resolveTarget,
        now,
      },
    );
  } catch {
    outcome = { ok: false as const, code: "publication_uncertain" as const };
  }

  // A provider return or a worker status alone is not proof. Re-read the durable, bound receipt.
  try {
    const completion = await db.$transaction(async (tx) => {
      const row = await tx.aiAgentRun.findFirst({
        where: { id: runId, clientId, agentKey: "review_responder" },
        select: { status: true, input: true, output: true, updatedAt: true },
      });
      if (!row) return null;
      const native = object(object(row.input).reviewNativePublication);
      if (
        native.profileId !== profileId ||
        native.claimedAt !== marker.claimedAt
      )
        return null;
      const binding = approvedBinding(row.input);
      if (
        !binding ||
        binding.source !== claim.binding.source ||
        binding.reviewId !== claim.binding.reviewId ||
        binding.replyHash !== claim.binding.replyHash ||
        binding.targetHash !== claim.binding.targetHash
      )
        return null;
      const confirmedAt = confirmedReceipt(row.input, binding);
      if (row.status !== "executing") return confirmedAt;
      const changed = await tx.aiAgentRun.updateMany({
        where: {
          id: runId,
          clientId,
          agentKey: "review_responder",
          status: "executing",
          updatedAt: row.updatedAt,
          input: jsonVersion(row.input),
          output: jsonVersion(row.output),
        },
        data: {
          status: confirmedAt ? "completed" : "failed",
          completedAt: now(),
          error: confirmedAt
            ? null
            : "publication_unconfirmed: verify the source before requesting another reply",
        },
      });
      if (changed.count !== 1) return null;
      await tx.auditLog.create({
        data: {
          clientId,
          profileId,
          action: confirmedAt
            ? "reputation.publication.completed"
            : "reputation.publication.unconfirmed",
          entityType: "ai_agent_run",
          entityId: runId,
          metadata: {
            source: binding.source,
            reviewId: binding.reviewId,
            replyHash: binding.replyHash,
            confirmed: confirmedAt ? 1 : 0,
          },
        },
      });
      return confirmedAt;
    });
    if (completion)
      return {
        ok: true,
        runId,
        replayed: outcome.ok ? outcome.replayed : false,
        confirmedAt: completion,
      };
  } catch {
    // The publisher lease is deliberately retained: never retry a possibly sent reply.
    return { ok: false, code: "publication_uncertain" };
  }
  return outcome.ok ? { ok: false, code: "publication_uncertain" } : outcome;
}
