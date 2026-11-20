import { NextRequest, NextResponse } from "next/server";

import { assertClientCanScheduleSocialPost } from "@/lib/billing/social/entitlement-gates";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";
import { requireWorkspaceApiPermission } from "@/lib/security/workspace-api";
import { readJsonBody } from "@/lib/security/write-request";
import {
  cancelSocialPostPublication,
  queueSocialPostPublication,
  runSocialPublicationWorkerTick,
} from "@/lib/social/publishing/publication-jobs";
import {
  BLOCK_REASON_LABELS,
  parseScheduleRequest,
  readPublicationReceipt,
} from "@/lib/social/publishing/publication-model";
import { getPrisma } from "@/lib/db/prisma";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { mode: "now" } | { mode: "schedule", scheduledAt: ISO }
 * Queues one durable delivery job for the post. "now" also processes that
 * job inline so the caller gets a verified provider result without waiting
 * for the scheduler.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("approve_content");
  if (!gate.ok) return gate.response;

  const { postId } = await context.params;
  if (!isUuid(postId)) {
    return jsonResponse({ ok: false, message: "The post identifier is invalid." }, 400);
  }

  const body = await readJsonBody(request, 4_096);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  const now = new Date();
  const schedule = parseScheduleRequest(body.body, now);
  if (!schedule) {
    return jsonResponse({ ok: false, message: "Choose publish now or a future date within one year." }, 400);
  }

  try {
    await assertClientCanScheduleSocialPost(gate.access.activeClientId);
    const queued = await queueSocialPostPublication({
      clientId: gate.access.activeClientId,
      socialPostId: postId,
      requestedByProfileId: gate.access.profileId ?? null,
      scheduledFor: schedule.mode === "now" ? now : schedule.scheduledAt,
    });
    if (!queued.ok) {
      if (queued.reason === "not_found") return jsonResponse({ ok: false, code: "not_found" }, 404);
      if (queued.reason === "unavailable") return jsonResponse({ ok: false, code: "unavailable" }, 503);
      const label = BLOCK_REASON_LABELS[queued.reason];
      return jsonResponse({ ok: false, code: queued.reason, message: label?.en, messageFr: label?.fr }, 409);
    }

    if (schedule.mode === "schedule") {
      return jsonResponse({ ok: true, state: "scheduled", jobId: queued.jobId, scheduledFor: queued.scheduledFor, replayed: queued.replayed }, 202);
    }

    const tick = await runSocialPublicationWorkerTick({ jobId: queued.jobId });
    const outcome = tick.outcomes[0] ?? null;
    const receipt = await currentReceipt(gate.access.activeClientId, postId);
    return jsonResponse(
      {
        ok: true,
        state: outcome?.outcome ?? "queued",
        jobId: queued.jobId,
        outcome,
        publication: receipt,
      },
      200);
  } catch (error) {
    return handleApiError("social-post-publish", error, "The publication request could not be processed.");
  }
}

/** DELETE cancels a queued or retrying publication and returns the post to approved. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("approve_content");
  if (!gate.ok) return gate.response;
  const { postId } = await context.params;
  if (!isUuid(postId)) {
    return jsonResponse({ ok: false, message: "The post identifier is invalid." }, 400);
  }
  const body = await readJsonBody(request, 1_024);
  if (!body.ok) return jsonResponse({ ok: false, message: body.message }, body.status);
  try {
    const result = await cancelSocialPostPublication({ clientId: gate.access.activeClientId, socialPostId: postId });
    if (!result.ok) {
      return jsonResponse({ ok: false, code: result.reason }, result.reason === "running" ? 409 : 404);
    }
    return jsonResponse({ ok: true, cancelled: result.cancelled }, 200);
  } catch (error) {
    return handleApiError("social-post-publish", error, "The publication request could not be processed.");
  }
}

/** GET returns the durable publication receipt (never the caption or tokens). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  const gate = await requireWorkspaceApiPermission("view_social");
  if (!gate.ok) return gate.response;
  const { postId } = await context.params;
  if (!isUuid(postId)) {
    return jsonResponse({ ok: false, message: "The post identifier is invalid." }, 400);
  }
  const receipt = await currentReceipt(gate.access.activeClientId, postId);
  return jsonResponse({ ok: true, publication: receipt }, 200);
}

async function currentReceipt(clientId: string, postId: string) {
  const prisma = getPrisma();
  if (!prisma) return null;
  const post = await prisma.socialPost.findFirst({
    where: { id: postId, clientId },
    select: { status: true, publishedAt: true, scheduledAt: true, metadata: true },
  });
  if (!post) return null;
  const receipt = readPublicationReceipt(post.metadata);
  return {
    status: post.status,
    scheduledAt: post.scheduledAt?.toISOString() ?? null,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    state: receipt?.state ?? null,
    remotePostId: receipt?.remotePostId ?? null,
    permalinkUrl: receipt?.permalinkUrl ?? null,
    errorCategory: receipt?.errorCategory ?? null,
    errorMessage: receipt?.errorMessage ?? null,
    attempts: receipt?.attempts ?? 0,
    startedAt: receipt?.startedAt ?? null,
    confirmedAt: receipt?.confirmedAt ?? null,
  };
}
