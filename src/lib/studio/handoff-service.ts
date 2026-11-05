import type { Prisma } from "@prisma/client";

type HandoffInput = { clientId: string; actorId: string; outputId: string; accountId: string };
type Eligibility = (input: { track: unknown; outputClientId: string; accountClientId: string; clientId: string; outputStatus: string; accountStatus: string; platform: string; content: string }) => boolean;
type HandoffPolicy = { outputSource: string; eligible: Eligibility; recordId(seed: string): string };

/** Caller supplies the authenticated workspace and an interactive transaction. No provider call. */
export async function handoffStudioDraft(tx: Prisma.TransactionClient, input: HandoffInput, policy: HandoffPolicy) {
  const { clientId, actorId, outputId, accountId } = input;
  // Lock before reading eligibility. Output serializes all destinations; account
  // lock prevents a concurrent disconnect/reassignment from using stale access.
  await tx.$queryRaw`SELECT id FROM saved_ai_outputs WHERE id=${outputId}::uuid AND "clientId"=${clientId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM social_accounts WHERE id=${accountId}::uuid AND "clientId"=${clientId}::uuid FOR UPDATE`;
  const output = await tx.savedAiOutput.findFirst({
    where: { id: outputId, clientId, metadata: { path: ["source"], equals: policy.outputSource } },
    select: { id: true, clientId: true, businessBrandId: true, content: true, metadata: true, status: true },
  });
  const account = await tx.socialAccount.findFirst({
    where: { id: accountId, clientId, status: "connected", accessStatus: { in: ["available", "selected"] }, isAvailableThroughAuth: true, OR: [{ businessBrandId: null }, { businessBrand: { clientId } }] },
    select: { id: true, clientId: true, businessBrandId: true, platform: true, status: true },
  });
  const meta = output?.metadata as Record<string, unknown> | null;
  if (!output || !account || !policy.eligible({ track: meta?.track, outputClientId: output.clientId, accountClientId: account.clientId, clientId, outputStatus: output.status, accountStatus: account.status, platform: account.platform, content: output.content }) ||
      (output.businessBrandId !== null && output.businessBrandId !== account.businessBrandId)) {
    return { ok: false as const, statusCode: 403, code: "handoff_unavailable" };
  }
  const postId = policy.recordId(`${clientId}:${output.id}:${account.id}:social-post`);
  const existing = await tx.socialPost.findFirst({
    where: { id: postId, clientId },
    select: { id: true, socialAccountId: true, businessBrandId: true, platform: true, caption: true, status: true, metadata: true, approvals: { where: { clientId }, select: { id: true, status: true } } },
  });
  if (existing) {
    const provenance = existing.metadata as Record<string, unknown> | null;
    if (existing.socialAccountId !== account.id || existing.businessBrandId !== account.businessBrandId || existing.platform !== account.platform || existing.caption !== output.content ||
        provenance?.source !== "takatakstudio" || provenance.savedOutputId !== output.id || existing.approvals.length !== 1) {
      return { ok: false as const, statusCode: 409, code: "handoff_requires_reconciliation" };
    }
    // A review may have progressed since the first request. Never reset it or
    // report a replay as a newly pending approval; this is no publication receipt.
    return { ok: true as const, statusCode: 200, id: existing.id, replayed: true, status: existing.status, approvalStatus: existing.approvals[0].status, publicationVerified: false as const };
  }
  await tx.socialPost.create({ data: { id: postId, clientId, businessBrandId: account.businessBrandId, socialAccountId: account.id, platform: account.platform, caption: output.content, status: "pending_approval", metadata: { source: "takatakstudio", savedOutputId: output.id, projectId: typeof meta?.projectId === "string" ? meta.projectId : "" } } });
  const approval = await tx.approval.create({ data: { clientId, businessBrandId: account.businessBrandId, socialPostId: postId, requestedByProfileId: actorId, status: "pending", comments: "TAKATAKSTUDIO social draft — account selected by workspace operator." }, select: { id: true } });
  const current = (output.metadata ?? {}) as Prisma.InputJsonObject;
  await tx.savedAiOutput.update({ where: { id: output.id, clientId }, data: { status: "sent_to_approval", businessBrandId: account.businessBrandId, metadata: { ...current, socialPostId: typeof current.socialPostId === "string" ? current.socialPostId : postId, approvalId: typeof current.approvalId === "string" ? current.approvalId : approval.id } } });
  return { ok: true as const, statusCode: 200, id: postId, replayed: false, status: "pending_approval" as const, approvalStatus: "pending" as const, publicationVerified: false as const };
}
