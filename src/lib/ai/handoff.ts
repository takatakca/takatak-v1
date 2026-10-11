// TK-069 — Send one saved AI Studio draft into the social approval queue.
// Uses SocialPost, Approval, and SavedAiOutput.metadata. No new table.

import type { Prisma, PrismaClient } from "@prisma/client";

export type HandoffCode = "sent" | "already" | "refused" | "unavailable" | "denied";

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
  input: { outputId: string; clientIds: string[] | null; profileId: string | null },
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

      const account = await tx.socialAccount.findFirst({
        where: {
          clientId: current.clientId,
          status: "connected",
          ...(current.businessBrandId ? { businessBrandId: current.businessBrandId } : {}),
        },
        select: { id: true, platform: true },
        orderBy: { updatedAt: "desc" },
      });

      const post = await tx.socialPost.create({
        data: {
          clientId: current.clientId,
          businessBrandId: current.businessBrandId,
          socialAccountId: account?.id ?? null,
          platform: account?.platform ?? "web",
          caption: current.content.trim().slice(0, CAPTION_LIMIT),
          status: "pending_approval",
          metadata: {
            source: "ai_studio",
            savedOutputId: current.id,
            title: current.title.slice(0, 200),
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
