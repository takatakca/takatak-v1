// TK-069 — Send one saved AI Studio draft into the social approval queue.
// Uses SocialPost, Approval, and SavedAiOutput.metadata. No new table.

import type { Prisma, PrismaClient, SocialPlatform } from "@prisma/client";

export type HandoffCode = "sent" | "already" | "refused" | "unavailable" | "denied" | "account_unavailable";

export type HandoffAccountOption = {
  id: string;
  platform: string;
  status: string;
  businessBrandId: string | null;
  /** True when the connected account can publish through TAKATAK today (Facebook Page with publishing access). */
  publishReady: boolean;
  updatedAt: Date;
};

export function accountPublishReady(account: {
  platform: string;
  accountType: string | null;
  accessStatus: string | null;
  metadata: unknown;
}): boolean {
  if (account.platform !== "facebook" || account.accountType !== "facebook_page") return false;
  if (account.accessStatus !== "selected") return false;
  const metadata =
    account.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
      ? (account.metadata as Record<string, unknown>)
      : {};
  return metadata.canPublish !== false;
}

/**
 * Pick the delivery target for a handed-off draft. An explicit request must
 * match a connected account of the workspace (and of the draft's brand when
 * both are known); otherwise prefer a publish-ready Facebook Page, then the
 * most recently updated connected account, then none (platform "web").
 */
export function chooseHandoffAccount(
  accounts: HandoffAccountOption[],
  requestedId: string | null,
  businessBrandId: string | null,
): { ok: true; account: HandoffAccountOption | null } | { ok: false; reason: "account_unavailable" } {
  const connected = accounts.filter(
    (account) =>
      account.status === "connected" &&
      (!businessBrandId || !account.businessBrandId || account.businessBrandId === businessBrandId),
  );
  if (requestedId) {
    const match = connected.find((account) => account.id === requestedId);
    return match ? { ok: true, account: match } : { ok: false, reason: "account_unavailable" };
  }
  const ready = connected.filter((account) => account.publishReady).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  if (ready[0]) return { ok: true, account: ready[0] };
  const recent = [...connected].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return { ok: true, account: recent[0] ?? null };
}

export type HandoffDecision =
  | { action: "already_sent"; socialPostId: string }
  | { action: "create" }
  | { action: "refused"; reason: "archived" | "empty" };

const CAPTION_LIMIT = 8000;

export function readHandoffPostId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const id = (metadata as Record<string, unknown>).socialPostId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function decideHandoff(output: {
  status: string;
  content: string;
  metadata: unknown;
}): HandoffDecision {
  const existing = readHandoffPostId(output.metadata);
  if (output.status === "sent_to_approval" && existing) {
    return { action: "already_sent", socialPostId: existing };
  }
  if (output.status === "archived") return { action: "refused", reason: "archived" };
  if (!output.content.trim()) return { action: "refused", reason: "empty" };
  return { action: "create" };
}

export function handoffNotice(code: string | undefined): { tone: "ok" | "warn"; fr: string; en: string } | null {
  switch (code) {
    case "sent":
      return {
        tone: "ok",
        fr: "Brouillon envoyé à l'approbation. Il est dans les tâches sociales, en attente. Rien n'est publié.",
        en: "Draft sent to approval. It is waiting in social tasks. Nothing is published.",
      };
    case "already":
      return {
        tone: "ok",
        fr: "Ce brouillon a déjà été envoyé à l'approbation.",
        en: "This draft was already sent to approval.",
      };
    case "refused":
      return {
        tone: "warn",
        fr: "Ce brouillon ne peut pas être envoyé (archivé ou vide).",
        en: "This draft cannot be sent (archived or empty).",
      };
    case "denied":
      return {
        tone: "warn",
        fr: "Ce brouillon n'appartient pas à votre espace.",
        en: "This draft is not in your workspace.",
      };
    case "unavailable":
      return {
        tone: "warn",
        fr: "L'envoi est indisponible pour le moment.",
        en: "Sending is unavailable right now.",
      };
    case "account_unavailable":
      return {
        tone: "warn",
        fr: "Ce compte social n'est pas connecté à cet espace ou à cette marque. Choisissez un autre compte.",
        en: "That social account is not connected to this workspace or brand. Choose another account.",
      };
    default:
      return null;
  }
}

function metadataObject(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
      out[key] = item;
    }
  }
  return out;
}

export async function commitSavedOutputHandoff(
  prisma: PrismaClient,
  input: {
    outputId: string;
    clientIds: string[] | null;
    profileId: string | null;
    /** Explicit delivery target chosen by the user; validated against the workspace. */
    socialAccountId?: string | null;
  },
): Promise<{ code: HandoffCode }> {
  const output = await prisma.savedAiOutput.findFirst({
    where: {
      id: input.outputId,
      ...(input.clientIds ? { clientId: { in: input.clientIds } } : {}),
    },
    select: {
      id: true,
      clientId: true,
      businessBrandId: true,
      title: true,
      content: true,
      status: true,
      metadata: true,
    },
  });
  if (!output) return { code: "denied" };

  const firstLook = decideHandoff(output);
  if (firstLook.action === "refused") return { code: "refused" };

  try {
    let code: HandoffCode = "sent";
    await prisma.$transaction(async (tx) => {
      const current = await tx.savedAiOutput.findFirst({
        where: { id: output.id, clientId: output.clientId },
        select: {
          id: true,
          clientId: true,
          businessBrandId: true,
          title: true,
          content: true,
          status: true,
          metadata: true,
        },
      });
      if (!current) {
        code = "denied";
        return;
      }
      const decision = decideHandoff(current);
      if (decision.action === "refused") {
        code = "refused";
        return;
      }
      if (decision.action === "already_sent") {
        const existing = await tx.socialPost.findFirst({
          where: { id: decision.socialPostId, clientId: current.clientId },
          select: { id: true },
        });
        if (existing) {
          code = "already";
          return;
        }
      }

      const claimed = await tx.savedAiOutput.updateMany({
        where: {
          id: current.id,
          clientId: current.clientId,
          status: { in: ["draft", "saved"] },
        },
        data: { status: "sent_to_approval" },
      });
      if (claimed.count === 0) {
        const fresh = await tx.savedAiOutput.findFirst({
          where: { id: current.id, clientId: current.clientId },
          select: { status: true, metadata: true },
        });
        const freshId = readHandoffPostId(fresh?.metadata);
        if (fresh?.status === "sent_to_approval" && freshId) {
          code = "already";
          return;
        }
        if (fresh?.status !== "sent_to_approval") {
          code = "refused";
          return;
        }
      }

      const candidates = await tx.socialAccount.findMany({
        where: { clientId: current.clientId, status: "connected" },
        select: {
          id: true,
          platform: true,
          status: true,
          businessBrandId: true,
          accountType: true,
          accessStatus: true,
          metadata: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      const choice = chooseHandoffAccount(
        candidates.map((candidate) => ({
          id: candidate.id,
          platform: candidate.platform,
          status: candidate.status,
          businessBrandId: candidate.businessBrandId,
          publishReady: accountPublishReady(candidate),
          updatedAt: candidate.updatedAt,
        })),
        input.socialAccountId ?? null,
        current.businessBrandId,
      );
      if (!choice.ok) {
        // Release the claim so the draft can be sent again with another account.
        await tx.savedAiOutput.updateMany({
          where: { id: current.id, clientId: current.clientId, status: "sent_to_approval" },
          data: { status: current.status === "saved" ? "saved" : "draft" },
        });
        code = "account_unavailable";
        return;
      }
      const account = choice.account;

      const post = await tx.socialPost.create({
        data: {
          clientId: current.clientId,
          businessBrandId: current.businessBrandId,
          socialAccountId: account?.id ?? null,
          platform: (account?.platform ?? "web") as SocialPlatform,
          caption: current.content.trim().slice(0, CAPTION_LIMIT),
          status: "pending_approval",
          metadata: {
            source: "ai_studio",
            savedOutputId: current.id,
            title: current.title.slice(0, 200),
            targetSocialAccountId: account?.id ?? null,
            targetPublishReady: account?.publishReady ?? false,
          },
        },
      });
      const approval = await tx.approval.create({
        data: {
          clientId: current.clientId,
          businessBrandId: current.businessBrandId,
          socialPostId: post.id,
          requestedByProfileId: input.profileId,
          status: "pending",
          comments: `Brouillon AI Studio : ${current.title}`.slice(0, 2000),
        },
      });
      const metadata: Prisma.InputJsonObject = {
        ...metadataObject(current.metadata),
        socialPostId: post.id,
        approvalId: approval.id,
      };
      await tx.savedAiOutput.update({
        where: { id: current.id },
        data: { status: "sent_to_approval", metadata },
      });
      code = "sent";
    });
    return { code };
  } catch (error) {
    console.error("[ai-handoff] send failed", error instanceof Error ? error.name : "error");
    return { code: "unavailable" };
  }
}
