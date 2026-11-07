import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { clientHasGrowthFeature } from "@/lib/billing/growth/entitlements";
import { getPrisma } from "@/lib/db/prisma";
import { replyToGoogleReview } from "@/lib/integrations/google-business/service";
import { postQmaps } from "@/lib/qmaps/remote";
import { QMAPS_BUSINESS_ID } from "@/lib/qmaps/bridge";
import {
  canonicalReviewReply,
  type ReviewDraftSource,
} from "./review-target-model";
import {
  resolveReviewTarget,
  reviewReplyHash,
  type ReviewTarget,
} from "./review-target";

export type ReviewPublishCode =
  | "invalid_request"
  | "not_found"
  | "not_active"
  | "approval_required"
  | "agent_disabled"
  | "plan_required"
  | "target_unavailable"
  | "review_changed"
  | "draft_mismatch"
  | "invalid_approval"
  | "unsupported_source"
  | "publication_pending"
  | "publication_uncertain"
  | "not_configured"
  | "source_unconfirmed"
  | "database_unavailable"
  | "state_changed";
export type ReviewPublishResult =
  | {
      ok: true;
      runId: string;
      source: "google" | "qmaps";
      reviewId: string;
      replayed: boolean;
      confirmedAt: string;
    }
  | { ok: false; code: ReviewPublishCode };
type RemoteResult = { ok: true } | { ok: false; reason: string };
export interface ReviewPublisherDependencies {
  database?: PrismaClient;
  hasFeature?: (
    clientId: string,
    feature: "reputation" | "ai_autopilot",
  ) => Promise<boolean>;
  googleReply?: (
    clientId: string,
    reviewId: string,
    text: string,
  ) => Promise<RemoteResult>;
  qmapsReply?: (body: {
    version: 1;
    clientId: string;
    businessId: string;
    reviewId: string;
    body: string;
  }) => Promise<RemoteResult>;
  resolveTarget?: (
    database: PrismaClient,
    clientId: string,
    source: ReviewDraftSource,
    reviewId: string,
  ) => Promise<ReviewTarget | null>;
  now?: () => Date;
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const HASH = /^[0-9a-f]{64}$/;
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));

/** Input is server-owned; worker reports can replace output but never this receipt. */
function publicationResult(
  input: Record<string, unknown>,
  runId: string,
  source: "google" | "qmaps",
  reviewId: string,
  replyHash: string,
): ReviewPublishResult | null {
  if (input.reviewPublication === undefined || input.reviewPublication === null)
    return null;
  const receipt = object(input.reviewPublication);
  if (receipt.replyHash !== replyHash)
    return { ok: false, code: "draft_mismatch" };
  if (
    receipt.source !== source ||
    receipt.reviewId !== reviewId ||
    typeof receipt.attemptId !== "string" ||
    !QMAPS_BUSINESS_ID.test(receipt.attemptId)
  )
    return { ok: false, code: "publication_uncertain" };
  if (receipt.state === "confirmed" && date(receipt.confirmedAt))
    return {
      ok: true,
      runId,
      source,
      reviewId,
      replayed: true,
      confirmedAt: receipt.confirmedAt,
    };
  if (receipt.state === "sending")
    return { ok: false, code: "publication_pending" };
  if (receipt.state === "not_sent")
    return { ok: false, code: "not_configured" };
  return { ok: false, code: "publication_uncertain" };
}

/** Publish exactly one run-bound reply, preserving uncertainty across retries. */
export async function publishReviewRunReply(
  runId: string,
  comment: unknown,
  dependencies: ReviewPublisherDependencies = {},
): Promise<ReviewPublishResult> {
  if (!QMAPS_BUSINESS_ID.test(runId))
    return { ok: false, code: "invalid_request" };
  const db = dependencies.database ?? getPrisma();
  if (!db) return { ok: false, code: "database_unavailable" };
  const run = await db.aiAgentRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      clientId: true,
      agentKey: true,
      status: true,
      input: true,
      output: true,
    },
  });
  if (!run || run.agentKey !== "review_responder")
    return { ok: false, code: "not_found" };
  if (!QMAPS_BUSINESS_ID.test(run.clientId))
    return { ok: false, code: "state_changed" };
  const input = object(run.input),
    output = object(run.output);
  const source = input.source;
  if (source !== "google" && source !== "qmaps")
    return { ok: false, code: "unsupported_source" };
  const reviewId = input.reviewResponseId;
  if (typeof reviewId !== "string" || !QMAPS_BUSINESS_ID.test(reviewId))
    return { ok: false, code: "invalid_request" };
  const text = canonicalReviewReply(source, comment);
  if (!text) return { ok: false, code: "invalid_request" };
  const replyHash = reviewReplyHash(text);
  const prior = publicationResult(input, run.id, source, reviewId, replyHash);
  // A durable source receipt can be replayed after reportAgentRun completed the job.
  if (prior) return prior;
  if (run.status !== "running" && run.status !== "executing")
    return { ok: false, code: "not_active" };
  const version = input.reviewWorkflowVersion;
  if (version !== undefined && version !== 1 && version !== 2)
    return { ok: false, code: "invalid_request" };
  const v2 = version === 2;
  const frozenApproval =
    input.reviewApproval !== undefined && input.reviewApproval !== null;
  if ((v2 || frozenApproval) && run.status !== "executing")
    return { ok: false, code: "approval_required" };
  const setting = await db.aiAgentSetting.findUnique({
    where: {
      clientId_agentKey: {
        clientId: run.clientId,
        agentKey: "review_responder",
      },
    },
    select: { enabled: true, requireApproval: true },
  });
  if (!setting?.enabled) return { ok: false, code: "agent_disabled" };
  // Preserve only the pre-existing Google legacy fast path; new workflow always executes a stored approved draft.
  if (
    run.status === "running" &&
    (v2 || source !== "google" || setting.requireApproval !== false)
  )
    return { ok: false, code: "approval_required" };
  const hasFeature = dependencies.hasFeature ?? clientHasGrowthFeature;
  if (
    !(await hasFeature(run.clientId, "reputation")) ||
    !(await hasFeature(run.clientId, "ai_autopilot"))
  )
    return { ok: false, code: "plan_required" };
  const draft = canonicalReviewReply(source, output.reply);
  if ((run.status === "executing" || v2 || draft !== null) && draft !== text)
    return { ok: false, code: "draft_mismatch" };
  const target = await (dependencies.resolveTarget ?? resolveReviewTarget)(
    db,
    run.clientId,
    source,
    reviewId,
  );
  if (!target || target.id !== reviewId || target.source !== source)
    return { ok: false, code: "target_unavailable" };
  if (
    source === "qmaps" &&
    (!target.qmapsReviewId ||
      !target.businessId ||
      !QMAPS_BUSINESS_ID.test(target.qmapsReviewId) ||
      !QMAPS_BUSINESS_ID.test(target.businessId))
  )
    return { ok: false, code: "target_unavailable" };
  const approval = object(input.reviewApproval);
  if (v2) {
    if (
      typeof input.reviewContentHash !== "string" ||
      !HASH.test(input.reviewContentHash) ||
      input.reviewContentHash !== target.fingerprint
    )
      return { ok: false, code: "review_changed" };
  }
  if (v2 || frozenApproval) {
    if (
      typeof approval.targetHash !== "string" ||
      !HASH.test(approval.targetHash)
    )
      return { ok: false, code: "invalid_approval" };
    if (approval.targetHash !== target.fingerprint)
      return { ok: false, code: "review_changed" };
    if (
      approval.replyHash !== replyHash ||
      canonicalReviewReply(source, approval.replyText) !== text ||
      !date(approval.at) ||
      typeof approval.profileId !== "string" ||
      !QMAPS_BUSINESS_ID.test(approval.profileId)
    )
      return { ok: false, code: "invalid_approval" };
  }
  const now = dependencies.now ?? (() => new Date());
  const attemptId = randomUUID();
  const attempt = {
    attemptId,
    state: "sending",
    replyHash,
    source,
    reviewId,
    targetHash: target.fingerprint,
    at: now().toISOString(),
  };
  const leasedInput = {
    ...input,
    reviewPublication: attempt,
  } as Prisma.InputJsonObject;
  const claimed = await db.aiAgentRun.updateMany({
    where: {
      id: run.id,
      clientId: run.clientId,
      agentKey: "review_responder",
      status: run.status,
      input: { equals: run.input as Prisma.InputJsonValue },
      ...(run.output !== null
        ? { output: { equals: run.output as Prisma.InputJsonValue } }
        : {}),
    },
    data: { input: leasedInput },
  });
  if (claimed.count !== 1) {
    const fresh = await db.aiAgentRun.findUnique({
      where: { id: run.id },
      select: { input: true },
    });
    return (
      publicationResult(
        object(fresh?.input),
        run.id,
        source,
        reviewId,
        replyHash,
      ) ?? { ok: false, code: "state_changed" }
    );
  }
  let remote: RemoteResult;
  try {
    remote =
      source === "google"
        ? await (dependencies.googleReply ?? replyToGoogleReview)(
            run.clientId,
            target.id,
            text,
          )
        : await (
            dependencies.qmapsReply ??
            ((body) => postQmaps("takatak-reply-review-v2", body))
          )({
            version: 1,
            clientId: run.clientId,
            businessId: target.businessId!,
            reviewId: target.qmapsReviewId!,
            body: text,
          });
  } catch {
    remote = { ok: false, reason: "unreachable" };
  }
  const state = remote.ok
    ? "confirmed"
    : remote.reason === "not_configured"
      ? "not_sent"
      : "uncertain";
  const finishedAt = now().toISOString();
  const completedInput = {
    ...input,
    reviewPublication: {
      ...attempt,
      state,
      finishedAt,
      ...(remote.ok ? { confirmedAt: finishedAt } : {}),
    },
  } as Prisma.InputJsonObject;
  try {
    await db.$transaction(async (tx) => {
      // The worker may report a terminal status while the source request is in flight; the immutable lease remains authoritative.
      const saved = await tx.aiAgentRun.updateMany({
        where: {
          id: run.id,
          clientId: run.clientId,
          agentKey: "review_responder",
          input: { equals: leasedInput },
        },
        data: { input: completedInput },
      });
      if (saved.count !== 1) throw new Error("publication_receipt_changed");
      if (remote.ok && source === "qmaps") {
        const tracked = await tx.listingReview.findFirst({
          where: {
            id: target.id,
            clientId: run.clientId,
            provider: "qmaps",
            status: { not: "archived" },
            metadata: {
              path: ["qmapsReviewId"],
              equals: target.qmapsReviewId!,
            },
            localListing: {
              clientId: run.clientId,
              provider: "qmaps",
              metadata: {
                path: ["qmapsBusinessId"],
                equals: target.businessId!,
              },
            },
          },
          select: { id: true, metadata: true, updatedAt: true },
        });
        if (tracked)
          await tx.listingReview.updateMany({
            where: {
              id: tracked.id,
              clientId: run.clientId,
              provider: "qmaps",
              updatedAt: tracked.updatedAt,
              status: { not: "archived" },
              localListing: {
                clientId: run.clientId,
                provider: "qmaps",
                metadata: {
                  path: ["qmapsBusinessId"],
                  equals: target.businessId!,
                },
              },
              metadata: {
                path: ["qmapsReviewId"],
                equals: target.qmapsReviewId!,
              },
            },
            data: {
              replyStatus: "replied_internal",
              metadata: {
                ...object(tracked.metadata),
                source: "qmaps",
                qmapsReviewId: target.qmapsReviewId!,
                replyText: text,
                replyState: "sent_to_qmaps",
                repliedAt: finishedAt,
              } as Prisma.InputJsonObject,
            },
          });
      }
      await tx.auditLog.create({
        data: {
          clientId: run.clientId,
          ...(v2 || frozenApproval
            ? { profileId: approval.profileId as string }
            : {}),
          action: remote.ok
            ? "reputation.reply.confirmed"
            : "reputation.reply.unconfirmed",
          entityType: "ai_agent_run",
          entityId: run.id,
          metadata: {
            source,
            reviewId,
            attemptId,
            replyHash,
            state,
            confirmed: remote.ok ? 1 : 0,
          },
        },
      });
    });
  } catch {
    // The source may have acted. Keeping the original sending lease blocks duplicate publication.
    return { ok: false, code: "publication_uncertain" };
  }
  return remote.ok
    ? {
        ok: true,
        runId: run.id,
        source,
        reviewId,
        replayed: false,
        confirmedAt: finishedAt,
      }
    : {
        ok: false,
        code: state === "not_sent" ? "not_configured" : "source_unconfirmed",
      };
}
